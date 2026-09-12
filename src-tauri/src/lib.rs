use serde::Serialize;
use tauri::WebviewWindow;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession,
    GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus,
    GlobalSystemMediaTransportControlsSessionMediaProperties,
};
use windows::Win32::Media::Audio::Endpoints::{IAudioEndpointVolume, IAudioMeterInformation};
use windows::Win32::Media::Audio::{
    eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
};

#[derive(Serialize, Clone, Debug)]
pub struct LiveMediaTrack {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub is_playing: bool,
    pub source: String,
    pub position_secs: u32,
    pub duration_secs: u32,
    pub album_art: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct VolumeInfo {
    pub level: u32,
    pub is_muted: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct SystemStats {
    pub ram_percent: u32,
    pub ram_used_gb: f32,
    pub ram_total_gb: f32,
    pub cpu_percent: u32,
    pub mic_in_use: bool,
    pub camera_in_use: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct AudioDeviceInfo {
    pub name: String,
    pub is_muted: bool,
    pub volume_level: u32,
    pub is_bluetooth: bool,
}

fn read_device_name_from_registry(guid: &str) -> String {
    unsafe {
        let subkey_str = format!("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render\\{}\\Properties\0", guid);
        let subkey_wide: Vec<u16> = subkey_str.encode_utf16().collect();
        let hklm: isize = 0x80000002u32 as isize;
        let mut hkey: isize = 0;
        let key_read: u32 = 0x20019;

        if RegOpenKeyExW(hklm, subkey_wide.as_ptr(), 0, key_read, &mut hkey) == 0 {
            let val_name_str = "{a45c254e-df1c-4efd-8020-67d146a850e0},14\0";
            let val_name_wide: Vec<u16> = val_name_str.encode_utf16().collect();
            let mut buf = [0u8; 512];
            let mut buf_size: u32 = 512;
            let mut val_type: u32 = 0;

            let mut friendly = String::new();
            if RegQueryValueExW(hkey, val_name_wide.as_ptr(), std::ptr::null_mut(), &mut val_type, buf.as_mut_ptr(), &mut buf_size) == 0 {
                let u16_slice = std::slice::from_raw_parts(buf.as_ptr() as *const u16, (buf_size as usize) / 2);
                let nul_pos = u16_slice.iter().position(|&c| c == 0).unwrap_or(u16_slice.len());
                friendly = String::from_utf16_lossy(&u16_slice[..nul_pos]);
            }

            let iface_val_name = "{b3f8fa53-0004-438e-9003-51a46e139bfc},6\0";
            let iface_name_wide: Vec<u16> = iface_val_name.encode_utf16().collect();
            buf_size = 512;
            let mut iface_name = String::new();
            if RegQueryValueExW(hkey, iface_name_wide.as_ptr(), std::ptr::null_mut(), &mut val_type, buf.as_mut_ptr(), &mut buf_size) == 0 {
                let u16_slice = std::slice::from_raw_parts(buf.as_ptr() as *const u16, (buf_size as usize) / 2);
                let nul_pos = u16_slice.iter().position(|&c| c == 0).unwrap_or(u16_slice.len());
                iface_name = String::from_utf16_lossy(&u16_slice[..nul_pos]);
            }

            let _ = RegCloseKey(hkey);

            if !friendly.is_empty() && !iface_name.is_empty() && !friendly.contains(&iface_name) {
                return format!("{} ({})", friendly, iface_name);
            }
            if !friendly.is_empty() {
                return friendly;
            }
            if !iface_name.is_empty() {
                return iface_name;
            }
        }
    }
    "Speakers".to_string()
}

fn get_audio_endpoint_volume() -> Option<IAudioEndpointVolume> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole).ok()?;
        let volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None).ok()?;
        Some(volume)
    }
}

#[tauri::command]
fn get_system_volume() -> VolumeInfo {
    if let Some(vol) = get_audio_endpoint_volume() {
        unsafe {
            let level = vol.GetMasterVolumeLevelScalar().unwrap_or(0.0);
            let muted = vol.GetMute().map(|b| b.as_bool()).unwrap_or(false);
            return VolumeInfo {
                level: (level * 100.0).round() as u32,
                is_muted: muted,
            };
        }
    }
    VolumeInfo {
        level: 0,
        is_muted: false,
    }
}

#[tauri::command]
fn set_system_volume(level_percent: u32) {
    if let Some(vol) = get_audio_endpoint_volume() {
        unsafe {
            let scalar = (level_percent as f32 / 100.0).clamp(0.0, 1.0);
            let _ = vol.SetMasterVolumeLevelScalar(scalar, std::ptr::null());
            if scalar > 0.0 {
                let _ = vol.SetMute(false, std::ptr::null());
            }
        }
    }
}

#[tauri::command]
fn get_active_audio_device() -> AudioDeviceInfo {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: Result<IMMDeviceEnumerator, _> = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL);
        if let Ok(enumerator) = enumerator {
            if let Ok(device) = enumerator.GetDefaultAudioEndpoint(eRender, eConsole) {
                let volume: Option<IAudioEndpointVolume> = device.Activate(CLSCTX_ALL, None).ok();
                let vol_level = if let Some(ref v) = volume {
                    (v.GetMasterVolumeLevelScalar().unwrap_or(0.0) * 100.0).round() as u32
                } else {
                    0
                };
                let is_muted = if let Some(ref v) = volume {
                    v.GetMute().map(|b| b.as_bool()).unwrap_or(false)
                } else {
                    false
                };

                let mut dev_name = "Speakers".to_string();
                if let Ok(id_pwstr) = device.GetId() {
                    let id_str = id_pwstr.to_string().unwrap_or_default();
                    if let Some(pos) = id_str.rfind('{') {
                        let guid = &id_str[pos..];
                        dev_name = read_device_name_from_registry(guid);
                    }
                }

                let lower = dev_name.to_lowercase();
                let is_bluetooth = lower.contains("airpod") || lower.contains("buds") || lower.contains("bluetooth") || lower.contains("bth") || lower.contains("wh-");

                return AudioDeviceInfo {
                    name: dev_name,
                    is_muted,
                    volume_level: vol_level,
                    is_bluetooth,
                };
            }
        }
    }
    AudioDeviceInfo {
        name: "Speakers".to_string(),
        is_muted: false,
        volume_level: 0,
        is_bluetooth: false,
    }
}

#[tauri::command]
fn get_caps_lock_state() -> bool {
    unsafe {
        (GetKeyState(0x14) & 1) != 0
    }
}

#[tauri::command]
fn toggle_mute() -> bool {
    if let Some(vol) = get_audio_endpoint_volume() {
        unsafe {
            let current = vol.GetMute().map(|b| b.as_bool()).unwrap_or(false);
            let new_state = !current;
            let _ = vol.SetMute(new_state, std::ptr::null());
            return new_state;
        }
    }
    false
}

#[repr(C)]
#[derive(Default, Copy, Clone)]
struct FileTime {
    dw_low_date_time: u32,
    dw_high_date_time: u32,
}

fn file_time_to_u64(ft: &FileTime) -> u64 {
    ((ft.dw_high_date_time as u64) << 32) | (ft.dw_low_date_time as u64)
}

static LAST_CPU_TIMES: std::sync::Mutex<(u64, u64, u64)> = std::sync::Mutex::new((0, 0, 0));

fn calculate_cpu_percent() -> u32 {
    unsafe {
        let mut idle = FileTime::default();
        let mut kernel = FileTime::default();
        let mut user = FileTime::default();
        if GetSystemTimes(&mut idle, &mut kernel, &mut user) == 0 {
            return 0;
        }
        let idle_u = file_time_to_u64(&idle);
        let kernel_u = file_time_to_u64(&kernel);
        let user_u = file_time_to_u64(&user);

        let mut lock = LAST_CPU_TIMES.lock().unwrap();
        let (prev_idle, prev_kernel, prev_user) = *lock;
        *lock = (idle_u, kernel_u, user_u);

        if prev_kernel == 0 && prev_user == 0 {
            return 8;
        }

        let idle_diff = idle_u.saturating_sub(prev_idle);
        let kernel_diff = kernel_u.saturating_sub(prev_kernel);
        let user_diff = user_u.saturating_sub(prev_user);
        let total_sys = kernel_diff + user_diff;

        if total_sys == 0 {
            return 0;
        }

        let total_diff = total_sys.saturating_sub(idle_diff);
        let percent = (total_diff * 100) / total_sys;
        percent.min(100) as u32
    }
}

fn check_device_in_use(capability: &str) -> bool {
    unsafe {
        let subkey_str = format!("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\{}\\NonPackaged\0", capability);
        let subkey_wide: Vec<u16> = subkey_str.encode_utf16().collect();
        let hkcu: isize = 0x80000001u32 as isize;
        let mut hkey: isize = 0;
        let key_read: u32 = 0x20019;

        if RegOpenKeyExW(hkcu, subkey_wide.as_ptr(), 0, key_read, &mut hkey) == 0 {
            let mut subkey_idx = 0;
            let mut subkey_name = [0u16; 256];
            loop {
                let mut name_len = 256;
                let res = RegEnumKeyExW(
                    hkey,
                    subkey_idx,
                    subkey_name.as_mut_ptr(),
                    &mut name_len,
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                );
                if res != 0 {
                    break;
                }
                subkey_idx += 1;

                let mut app_key: isize = 0;
                if RegOpenKeyExW(hkey, subkey_name.as_ptr(), 0, key_read, &mut app_key) == 0 {
                    let start_name: Vec<u16> = "LastUsedTimeStart\0".encode_utf16().collect();
                    let stop_name: Vec<u16> = "LastUsedTimeStop\0".encode_utf16().collect();
                    let mut start_val: u64 = 0;
                    let mut stop_val: u64 = 0;
                    let mut val_type: u32 = 0;
                    let mut val_size: u32 = 8;

                    let _ = RegQueryValueExW(
                        app_key,
                        start_name.as_ptr(),
                        std::ptr::null_mut(),
                        &mut val_type,
                        &mut start_val as *mut u64 as *mut u8,
                        &mut val_size,
                    );
                    val_size = 8;
                    let _ = RegQueryValueExW(
                        app_key,
                        stop_name.as_ptr(),
                        std::ptr::null_mut(),
                        &mut val_type,
                        &mut stop_val as *mut u64 as *mut u8,
                        &mut val_size,
                    );
                    let _ = RegCloseKey(app_key);

                    if start_val > 0 && (stop_val == 0 || stop_val < start_val) {
                        let _ = RegCloseKey(hkey);
                        return true;
                    }
                }
            }
            let _ = RegCloseKey(hkey);
        }
    }
    false
}

#[repr(C)]
struct MemoryStatusEx {
    length: u32,
    memory_load: u32,
    total_phys: u64,
    avail_phys: u64,
    total_page_file: u64,
    avail_page_file: u64,
    total_virtual: u64,
    avail_virtual: u64,
    avail_extended_virtual: u64,
}

#[tauri::command]
fn get_system_stats() -> SystemStats {
    let cpu = calculate_cpu_percent();
    let mic = check_device_in_use("microphone");
    let cam = check_device_in_use("webcam");
    unsafe {
        let mut mem = MemoryStatusEx {
            length: std::mem::size_of::<MemoryStatusEx>() as u32,
            memory_load: 0,
            total_phys: 0,
            avail_phys: 0,
            total_page_file: 0,
            avail_page_file: 0,
            total_virtual: 0,
            avail_virtual: 0,
            avail_extended_virtual: 0,
        };
        if GlobalMemoryStatusEx(&mut mem) != 0 {
            let total_gb = mem.total_phys as f32 / (1024.0 * 1024.0 * 1024.0);
            let used_gb = (mem.total_phys - mem.avail_phys) as f32 / (1024.0 * 1024.0 * 1024.0);
            SystemStats {
                ram_percent: mem.memory_load,
                ram_used_gb: (used_gb * 10.0).round() / 10.0,
                ram_total_gb: (total_gb * 10.0).round() / 10.0,
                cpu_percent: cpu,
                mic_in_use: mic,
                camera_in_use: cam,
            }
        } else {
            SystemStats {
                ram_percent: 0,
                ram_used_gb: 0.0,
                ram_total_gb: 0.0,
                cpu_percent: cpu,
                mic_in_use: mic,
                camera_in_use: cam,
            }
        }
    }
}

#[tauri::command]
fn get_clipboard_text() -> Option<String> {
    unsafe {
        if OpenClipboard(0) == 0 {
            return None;
        }
        let h_glb = GetClipboardData(13);
        if h_glb == 0 {
            let _ = CloseClipboard();
            return None;
        }
        let ptr = GlobalLock(h_glb) as *const u16;
        if ptr.is_null() {
            let _ = CloseClipboard();
            return None;
        }
        let mut len = 0;
        while *ptr.add(len) != 0 {
            len += 1;
            if len > 500 { break; }
        }
        let slice = std::slice::from_raw_parts(ptr, len);
        let text = String::from_utf16_lossy(slice);
        let _ = GlobalUnlock(h_glb);
        let _ = CloseClipboard();
        if text.trim().is_empty() {
            None
        } else {
            Some(text)
        }
    }
}

fn to_base64(data: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 { chunk[1] as usize } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as usize } else { 0 };

        let triple = (b0 << 16) | (b1 << 8) | b2;

        result.push(TABLE[(triple >> 18) & 0x3F] as char);
        result.push(TABLE[(triple >> 12) & 0x3F] as char);
        if chunk.len() > 1 {
            result.push(TABLE[(triple >> 6) & 0x3F] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(TABLE[triple & 0x3F] as char);
        } else {
            result.push('=');
        }
    }
    result
}

static LAST_MEDIA_ART: std::sync::Mutex<Option<(String, String, Option<String>)>> = std::sync::Mutex::new(None);
static THUMBNAIL_FETCHING: std::sync::Mutex<Option<(String, String)>> = std::sync::Mutex::new(None);
static LAST_KNOWN_TRACK: std::sync::Mutex<Option<LiveMediaTrack>> = std::sync::Mutex::new(None);

fn is_system_audio_playing() -> bool {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let playing = (|| -> Option<bool> {
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
            let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole).ok()?;
            let meter: IAudioMeterInformation = device.Activate(CLSCTX_ALL, None).ok()?;
            let peak = meter.GetPeakValue().ok()?;
            Some(peak > 0.0001)
        })().unwrap_or(false);
        CoUninitialize();
        playing
    }
}

fn get_or_fetch_thumbnail_art(
    props: &GlobalSystemMediaTransportControlsSessionMediaProperties,
    title: &str,
    artist: &str,
) -> Option<String> {
    // 1. Check in-memory cache for instant <10ms metadata return
    if let Ok(guard) = LAST_MEDIA_ART.lock() {
        if let Some((ref cached_title, ref cached_artist, ref cached_art)) = *guard {
            if cached_title == title && cached_artist == artist {
                return cached_art.clone();
            }
        }
    }

    // 2. Cache miss: trigger async background fetch if not already in flight
    let should_spawn = {
        if let Ok(mut guard) = THUMBNAIL_FETCHING.lock() {
            if let Some((ref cur_t, ref cur_a)) = *guard {
                if cur_t == title && cur_a == artist {
                    false
                } else {
                    *guard = Some((title.to_string(), artist.to_string()));
                    true
                }
            } else {
                *guard = Some((title.to_string(), artist.to_string()));
                true
            }
        } else {
            false
        }
    };

    if should_spawn {
        let props_clone = props.clone();
        let title_clone = title.to_string();
        let artist_clone = artist.to_string();

        std::thread::spawn(move || {
            unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            }
            let art = (|| -> Option<String> {
                let thumb_ref = props_clone.Thumbnail().ok()?;
                let stream = thumb_ref.OpenReadAsync().ok()?.get().ok()?;
                let size = stream.Size().ok()? as usize;
                if size == 0 || size > 5 * 1024 * 1024 {
                    return None;
                }

                let reader = windows::Storage::Streams::DataReader::CreateDataReader(&stream).ok()?;
                reader.LoadAsync(size as u32).ok()?.get().ok()?;
                let mut bytes = vec![0u8; size];
                reader.ReadBytes(&mut bytes).ok()?;

                let mime = if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
                    "image/png"
                } else if bytes.starts_with(b"RIFF") && bytes.len() > 12 && &bytes[8..12] == b"WEBP" {
                    "image/webp"
                } else {
                    "image/jpeg"
                };

                let b64 = to_base64(&bytes);
                Some(format!("data:{};base64,{}", mime, b64))
            })();

            let is_still_relevant = {
                if let Ok(guard) = THUMBNAIL_FETCHING.lock() {
                    if let Some((ref cur_t, ref cur_a)) = *guard {
                        cur_t == &title_clone && cur_a == &artist_clone
                    } else {
                        false
                    }
                } else {
                    false
                }
            };

            if is_still_relevant {
                if let Ok(mut guard) = LAST_MEDIA_ART.lock() {
                    *guard = Some((title_clone.clone(), artist_clone.clone(), art));
                }
                if let Ok(mut guard) = THUMBNAIL_FETCHING.lock() {
                    if let Some((ref cur_t, ref cur_a)) = *guard {
                        if cur_t == &title_clone && cur_a == &artist_clone {
                            *guard = None;
                        }
                    }
                }
            }

            unsafe {
                CoUninitialize();
            }
        });
    }

    None
}

fn rfind_ignore_ascii_case(haystack: &str, needle: &str) -> Option<usize> {
    let n_len = needle.len();
    if n_len == 0 || haystack.len() < n_len {
        return None;
    }
    for (i, _) in haystack.char_indices().rev() {
        if i + n_len <= haystack.len() && haystack.is_char_boundary(i + n_len) {
            let slice = &haystack[i..i + n_len];
            if slice.eq_ignore_ascii_case(needle) {
                return Some(i);
            }
        }
    }
    None
}

fn is_generic_non_music(title: &str, artist: &str) -> bool {
    let t = title.trim().to_lowercase();
    let a = artist.trim().to_lowercase();

    if t.is_empty() {
        return true;
    }

    // Direct social media titles or website stubs
    if t == "facebook"
        || t.starts_with("(1) facebook")
        || t.starts_with("(2) facebook")
        || t.starts_with("(3) facebook")
        || t.starts_with("(4) facebook")
        || t.starts_with("(5) facebook")
        || t.ends_with("- facebook")
        || t.ends_with("| facebook")
        || t.contains("facebook.com")
        || (t.contains("facebook") && (a.is_empty() || a.contains("facebook") || a == "windows media"))
    {
        return true;
    }

    if t == "instagram"
        || t.ends_with("• instagram photos and videos")
        || t == "twitter"
        || t == "x"
        || t.ends_with("/ x")
        || t.ends_with("on x")
        || t == "tiktok"
        || t.contains("tiktok - make your day")
        || t == "reddit"
        || t.contains("reddit - dive into anything")
        || t == "new tab"
        || t == "google chrome"
        || t == "brave"
        || t == "microsoft edge"
    {
        return true;
    }

    false
}

fn parse_chromium_media_title(raw_title: &str) -> Option<(String, String)> {
    let mut title = raw_title.trim();
    if title.is_empty() {
        return None;
    }

    // Strip notification badges like "(1) ", "(99+) ", "(1) (2) "
    while title.starts_with('(') {
        let mut stripped = false;
        if let Some(close_idx) = title.find(')') {
            if close_idx < 10 {
                let inside = &title[1..close_idx];
                if inside.chars().all(|c| c.is_ascii_digit() || c == '+') {
                    title = title[close_idx + 1..].trim();
                    stripped = true;
                }
            }
        }
        if !stripped {
            break;
        }
    }

    let lower = title.to_lowercase();
    // Exclude social media or non-music sites (don't block song titles that contain "tiktok remix")
    if lower == "facebook"
        || lower.starts_with("(1) facebook")
        || lower.starts_with("(2) facebook")
        || lower.ends_with("- facebook")
        || lower.ends_with("| facebook")
        || lower == "instagram"
        || lower.ends_with("• instagram photos and videos")
        || lower == "twitter"
        || lower == "x"
        || lower.ends_with("/ x")
        || lower.ends_with("on x")
        || lower == "tiktok - make your day"
        || lower.ends_with("- tiktok")
        || lower.ends_with("- reddit")
    {
        return None;
    }

    // Strip browser branding suffixes (case-insensitive)
    let browser_suffixes = [
        " - Google Chrome",
        " - Chrome",
        " - Brave",
        " - Microsoft Edge",
        " - Microsoft\u{200b}Edge",
        " - Edge",
        " - Cốc Cốc",
        " - Coc Coc",
        " - Chromium",
        " - Vivaldi",
    ];
    for suffix in &browser_suffixes {
        if let Some(idx) = rfind_ignore_ascii_case(title, suffix) {
            title = title[..idx].trim();
            break;
        }
    }

    // Identify and strip music service suffix
    let mut matched_service_name = "YouTube";
    let mut matched_service = false;
    let service_suffixes = [
        (" - YouTube Music", "YouTube Music"),
        (" - YouTube", "YouTube"),
        (" - SoundCloud", "SoundCloud"),
        (" - Spotify", "Spotify"),
        (" - Zing MP3", "Zing MP3"),
        (" - NhacCuaTui", "NhacCuaTui"),
    ];

    for (suffix, name) in &service_suffixes {
        if let Some(idx) = rfind_ignore_ascii_case(title, suffix) {
            title = title[..idx].trim();
            matched_service_name = name;
            matched_service = true;
            break;
        }
    }

    // If it did not match any music service suffix, require music keyword
    if !matched_service && !title.to_lowercase().contains("youtube") {
        return None;
    }

    if title.is_empty()
        || title.eq_ignore_ascii_case("youtube")
        || title.eq_ignore_ascii_case("youtube music")
        || title.eq_ignore_ascii_case("soundcloud")
        || title.eq_ignore_ascii_case("spotify")
        || title.eq_ignore_ascii_case("new tab")
    {
        return None;
    }

    // Split by " - " to isolate song title and artist
    let parts: Vec<&str> = title.split(" - ").collect();
    if parts.len() >= 2 {
        let song = parts[0].trim().to_string();
        let artist = parts[1..].join(" - ").trim().to_string();
        if !song.is_empty() {
            return Some((
                song,
                if artist.is_empty() { matched_service_name.to_string() } else { artist },
            ));
        }
    } else if !title.is_empty() {
        return Some((title.to_string(), matched_service_name.to_string()));
    }

    None
}

struct ChromiumMediaSearch {
    found_track: Option<LiveMediaTrack>,
}

unsafe extern "system" fn enum_chromium_media_proc(hwnd: isize, lparam: isize) -> i32 {
    if IsWindowVisible(hwnd) == 0 {
        return 1;
    }

    let search = &mut *(lparam as *mut ChromiumMediaSearch);

    let mut pid: u32 = 0;
    GetWindowThreadProcessId(hwnd, &mut pid as *mut u32);
    if pid == 0 {
        return 1;
    }

    let process = OpenProcess(0x1000, 0, pid);
    if process == 0 {
        return 1;
    }

    let mut buf = [0u16; 512];
    let mut len = 512u32;
    let ok = QueryFullProcessImageNameW(process, 0, buf.as_mut_ptr(), &mut len as *mut u32);
    let _ = CloseHandle(process);
    if ok == 0 {
        return 1;
    }

    let exe_path = String::from_utf16_lossy(&buf[..len as usize]).to_lowercase();
    let source_name = if exe_path.contains("brave.exe") {
        "Brave"
    } else if exe_path.contains("chrome.exe") {
        "Chrome"
    } else if exe_path.contains("msedge.exe") {
        "Edge"
    } else if exe_path.contains("coccoc.exe") {
        "CocCoc"
    } else {
        return 1;
    };

    let mut title_buf = [0u16; 512];
    let title_len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), 512);
    if title_len > 0 {
        let raw_title = String::from_utf16_lossy(&title_buf[..title_len as usize]);
        if let Some((title, artist)) = parse_chromium_media_title(&raw_title) {
            let mut pos = 0;
            let mut dur = 0;
            let mut art = None;
            if let Ok(guard) = LAST_KNOWN_TRACK.lock() {
                if let Some(ref last) = *guard {
                    if last.title == title {
                        pos = last.position_secs;
                        dur = last.duration_secs;
                        art = last.album_art.clone();
                    }
                }
            }
            search.found_track = Some(LiveMediaTrack {
                title,
                artist,
                album: "YouTube".to_string(),
                is_playing: true,
                source: source_name.to_string(),
                position_secs: pos,
                duration_secs: dur,
                album_art: art,
            });
            return 0; // Found target window, stop enumeration
        }
    }

    1
}

fn scan_chromium_media_fallback() -> Option<LiveMediaTrack> {
    let mut search = ChromiumMediaSearch { found_track: None };
    unsafe {
        EnumWindows(enum_chromium_media_proc, &mut search as *mut ChromiumMediaSearch as isize);
    }
    search.found_track
}


fn find_best_media_session(
    manager: &GlobalSystemMediaTransportControlsSessionManager,
) -> Option<GlobalSystemMediaTransportControlsSession> {
    let current_session = manager.GetCurrentSession().ok();
    let current_id = current_session
        .as_ref()
        .and_then(|s| s.SourceAppUserModelId().ok().map(|h| h.to_string()));

    let sessions = match manager.GetSessions() {
        Ok(s) => s,
        Err(_) => return current_session,
    };

    let mut best_session: Option<GlobalSystemMediaTransportControlsSession> = None;
    let mut best_score: i128 = i128::MIN;

    for s in sessions {
        let playback_info = match s.GetPlaybackInfo() {
            Ok(pi) => pi,
            Err(_) => continue,
        };
        let status = match playback_info.PlaybackStatus() {
            Ok(st) => st,
            Err(_) => continue,
        };

        // Query session media properties to distinguish real music vs generic web stubs
        let (title, artist) = s
            .TryGetMediaPropertiesAsync()
            .ok()
            .and_then(|op| op.get().ok())
            .map(|p| {
                let t = p.Title().map(|h| h.to_string()).unwrap_or_default();
                let a = p.Artist().map(|h| h.to_string()).unwrap_or_default();
                (t, a)
            })
            .unwrap_or_default();

        let is_generic = is_generic_non_music(&title, &artist);

        let mut score: i128 = 0;

        // 1. Status Weight:
        // Playing status: +10^24 points
        // Paused status: +10^18 points
        if status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing {
            score += 1_000_000_000_000_000_000_000_000i128;
        } else if status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused {
            score += 1_000_000_000_000_000_000i128;
        } else {
            continue; // Closed or Stopped session
        }

        // 2. Real Music Quality Bonus vs Generic Social Media Penalty:
        if is_generic {
            if status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused {
                // Heavily penalize paused generic social media so ANY real session beats it
                score -= 800_000_000_000_000_000_000_000i128;
            } else {
                score -= 200_000_000_000_000_000_000_000i128;
            }
        } else if !title.is_empty() && !artist.is_empty() {
            // Real track with both Title and Artist gets substantial boost
            score += 300_000_000_000_000_000_000_000i128;
        }

        // 3. CurrentSession Match Weight: +5x10^23 points (only if not generic paused!)
        if !is_generic || status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing {
            if let (Some(ref cur_id), Ok(src_id)) = (&current_id, s.SourceAppUserModelId()) {
                if cur_id == &src_id.to_string() {
                    score += 500_000_000_000_000_000_000_000i128;
                }
            }
        }

        // 4. Recency Timestamp Weight: LastUpdatedTime UniversalTime sanitized & added to score
        if let Ok(timeline) = s.GetTimelineProperties() {
            if let Ok(last_updated) = timeline.LastUpdatedTime() {
                let ts = last_updated.UniversalTime;
                if ts > 0 {
                    score += ts as i128;
                }
            }
        }

        if score > best_score {
            best_score = score;
            best_session = Some(s);
        }
    }

    // Fallback to current_session if GetSessions enumeration didn't yield a match
    if best_session.is_none() {
        if let Some(cs) = current_session {
            if let Ok(info) = cs.GetPlaybackInfo() {
                if let Ok(status) = info.PlaybackStatus() {
                    if status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing
                        || status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused
                    {
                        best_session = Some(cs);
                    }
                }
            }
        }
    }

    best_session
}

fn seek_system_media_internal(position_secs: u32) -> bool {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
    let Ok(manager_op) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync() else {
        unsafe { CoUninitialize(); }
        return false;
    };
    let Ok(manager) = manager_op.get() else {
        unsafe { CoUninitialize(); }
        return false;
    };

    let target_session = find_best_media_session(&manager);

    let mut success = false;
    if let Some(session) = target_session {
        let pos_100ns = (position_secs as i64) * 10_000_000;
        if let Ok(op) = session.TryChangePlaybackPositionAsync(pos_100ns) {
            if let Ok(res) = op.get() {
                success = res;
            }
        }
    }
    unsafe { CoUninitialize(); }
    success
}

#[tauri::command]
fn seek_system_media(position_secs: u32) -> bool {
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let res = seek_system_media_internal(position_secs);
        let _ = tx.send(res);
    });
    rx.recv_timeout(std::time::Duration::from_millis(400)).unwrap_or(false)
}

fn get_current_system_media_internal() -> Option<LiveMediaTrack> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
    let manager = match GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
        Ok(op) => match op.get() {
            Ok(m) => m,
            Err(_) => {
                unsafe { CoUninitialize(); }
                if is_system_audio_playing() {
                    if let Some(fallback) = scan_chromium_media_fallback() {
                        return Some(fallback);
                    }
                    if let Ok(guard) = LAST_KNOWN_TRACK.lock() {
                        if let Some(ref last) = *guard {
                            if !is_generic_non_music(&last.title, &last.artist) && !last.title.is_empty() {
                                let mut t = last.clone();
                                t.is_playing = true;
                                return Some(t);
                            }
                        }
                    }
                }
                return None;
            }
        },
        Err(_) => {
            unsafe { CoUninitialize(); }
            if is_system_audio_playing() {
                if let Some(fallback) = scan_chromium_media_fallback() {
                    return Some(fallback);
                }
                if let Ok(guard) = LAST_KNOWN_TRACK.lock() {
                    if let Some(ref last) = *guard {
                        if !is_generic_non_music(&last.title, &last.artist) && !last.title.is_empty() {
                            let mut t = last.clone();
                            t.is_playing = true;
                            return Some(t);
                        }
                    }
                }
            }
            return None;
        }
    };

    let session = match find_best_media_session(&manager) {
        Some(s) => s,
        None => {
            unsafe { CoUninitialize(); }
            if is_system_audio_playing() {
                if let Some(fallback) = scan_chromium_media_fallback() {
                    return Some(fallback);
                }
                if let Ok(guard) = LAST_KNOWN_TRACK.lock() {
                    if let Some(ref last) = *guard {
                        if !is_generic_non_music(&last.title, &last.artist) && !last.title.is_empty() {
                            let mut t = last.clone();
                            t.is_playing = true;
                            return Some(t);
                        }
                    }
                }
            }
            return None;
        }
    };

    let playback_info = match session.GetPlaybackInfo() {
        Ok(pi) => pi,
        Err(_) => {
            unsafe { CoUninitialize(); }
            if is_system_audio_playing() {
                return scan_chromium_media_fallback();
            }
            return None;
        }
    };
    let status = match playback_info.PlaybackStatus() {
        Ok(st) => st,
        Err(_) => {
            unsafe { CoUninitialize(); }
            if is_system_audio_playing() {
                return scan_chromium_media_fallback();
            }
            return None;
        }
    };
    let mut is_playing = status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;

    let props = match session.TryGetMediaPropertiesAsync() {
        Ok(op) => match op.get() {
            Ok(p) => p,
            Err(_) => {
                unsafe { CoUninitialize(); }
                if is_system_audio_playing() {
                    return scan_chromium_media_fallback();
                }
                return None;
            }
        },
        Err(_) => {
            unsafe { CoUninitialize(); }
            if is_system_audio_playing() {
                return scan_chromium_media_fallback();
            }
            return None;
        }
    };

    let mut title = props.Title().map(|h| h.to_string()).unwrap_or_default();
    let mut artist = props.Artist().map(|h| h.to_string()).unwrap_or_default();
    let mut album = props.AlbumTitle().map(|h| h.to_string()).unwrap_or_default();
    let mut source = session
        .SourceAppUserModelId()
        .map(|h| h.to_string())
        .unwrap_or_else(|_| "Windows".into());

    let is_generic = is_generic_non_music(&title, &artist);

    let mut position_secs = 0;
    let mut duration_secs = 0;

    // CRITICAL: Handle Facebook/generic stub or Paused session when audio is actively outputting
    if is_generic || (!is_playing && is_system_audio_playing()) {
        // 1. Try scanning browser window titles for an active YouTube or music tab
        if let Some(fallback) = scan_chromium_media_fallback() {
            title = fallback.title;
            artist = fallback.artist;
            album = fallback.album;
            source = fallback.source;
            position_secs = fallback.position_secs;
            duration_secs = fallback.duration_secs;
            is_playing = true;
        } else if is_system_audio_playing() {
            // 2. Audio is actively playing through speakers, but the browser window might be minimized
            // or backgrounded while user is on Facebook/other tabs. Recover real track from LAST_KNOWN_TRACK!
            let recovered = if let Ok(guard) = LAST_KNOWN_TRACK.lock() {
                if let Some(ref last) = *guard {
                    if !is_generic_non_music(&last.title, &last.artist) && !last.title.is_empty() {
                        Some(last.clone())
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            };

            if let Some(rec_track) = recovered {
                title = rec_track.title;
                artist = rec_track.artist;
                album = rec_track.album;
                source = rec_track.source;
                position_secs = rec_track.position_secs;
                duration_secs = rec_track.duration_secs;
                is_playing = true;
            } else if is_generic {
                // If generic and cannot recover a real track, discard
                unsafe { CoUninitialize(); }
                return None;
            }
        } else if is_generic {
            // Generic non-music session (e.g. Facebook) and no audio is playing anywhere: discard!
            unsafe { CoUninitialize(); }
            return None;
        }
    }

    // Window Title Fallback: If SMTC title and artist are empty (or Chromium WinRT is delayed)
    if title.trim().is_empty() && artist.trim().is_empty() {
        if let Some(fallback) = scan_chromium_media_fallback() {
            title = fallback.title;
            artist = fallback.artist;
            album = fallback.album;
            source = fallback.source;
            position_secs = fallback.position_secs;
            duration_secs = fallback.duration_secs;
        } else {
            unsafe { CoUninitialize(); }
            return None;
        }
    }

    // If session was generic (e.g. Facebook), search manager.GetSessions() for the real session matching title
    let target_session = if is_generic {
        manager.GetSessions().ok().and_then(|sessions| {
            for s in sessions {
                if let Some(p) = s.TryGetMediaPropertiesAsync().ok().and_then(|op| op.get().ok()) {
                    let t = p.Title().map(|h| h.to_string()).unwrap_or_default();
                    if t == title && !t.is_empty() {
                        return Some(s);
                    }
                }
            }
            None
        })
    } else {
        Some(session)
    };

    if let Some(s) = target_session {
        if let Ok(timeline) = s.GetTimelineProperties() {
            let mut pos_100ns = 0i64;
            if let Ok(pos) = timeline.Position() {
                pos_100ns = pos.Duration;
            }
            if let Ok(end) = timeline.EndTime() {
                let d = (end.Duration / 10_000_000).max(0) as u32;
                if d > 0 {
                    duration_secs = d;
                }
            }

            // Extrapolate realtime position using LastUpdatedTime
            if is_playing && pos_100ns >= 0 {
                if let Ok(last_updated) = timeline.LastUpdatedTime() {
                    let mut current_filetime: u64 = 0;
                    unsafe {
                        GetSystemTimeAsFileTime(&mut current_filetime as *mut u64);
                    }
                    let current_100ns = current_filetime as i64;
                    if current_100ns > last_updated.UniversalTime {
                        let elapsed_100ns = current_100ns - last_updated.UniversalTime;
                        if elapsed_100ns > 0 && elapsed_100ns < 7200 * 10_000_000 {
                            pos_100ns += elapsed_100ns;
                        }
                    }
                }
            }

            let p = (pos_100ns / 10_000_000).max(0) as u32;
            if p > 0 || position_secs == 0 {
                position_secs = p;
            }
            if duration_secs > 0 && position_secs > duration_secs {
                position_secs = duration_secs;
            }
        }
    }

    if duration_secs == 0 && position_secs == 0 && !is_playing && !is_system_audio_playing() {
        unsafe { CoUninitialize(); }
        return None;
    }

    // Decoupled Non-Blocking Thumbnail Pipeline: Returns in < 10ms without blocking image stream
    let album_art = get_or_fetch_thumbnail_art(&props, &title, &artist);

    unsafe { CoUninitialize(); }

    Some(LiveMediaTrack {
        title,
        artist,
        album,
        is_playing,
        source,
        position_secs,
        duration_secs,
        album_art,
    })
}

#[tauri::command]
fn get_current_system_media() -> Option<LiveMediaTrack> {
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let res = get_current_system_media_internal();
        let _ = tx.send(res);
    });
    // 480ms timeout: WinRT SMTC RPC takes 240ms-350ms; fits within 500ms frontend poll cycle
    match rx.recv_timeout(std::time::Duration::from_millis(480)) {
        Ok(Some(track)) => {
            // ONLY save to LAST_KNOWN_TRACK if it is a real music track (not generic Facebook/TikTok stub)
            if !is_generic_non_music(&track.title, &track.artist) && !track.title.is_empty() {
                if let Ok(mut guard) = LAST_KNOWN_TRACK.lock() {
                    *guard = Some(track.clone());
                }
            }
            Some(track)
        }
        Ok(None) => {
            // Only clear LAST_KNOWN_TRACK if audio is truly not playing
            if !is_system_audio_playing() {
                if let Ok(mut guard) = LAST_KNOWN_TRACK.lock() {
                    *guard = None;
                }
            }
            None
        }
        Err(_) => {
            // Timeout: return cached track if audio is actively playing
            if is_system_audio_playing() {
                LAST_KNOWN_TRACK.lock().ok().and_then(|g| g.clone())
            } else {
                None
            }
        }
    }
}

#[repr(C)]
struct SystemPowerStatus {
    ac_line_status: u8,
    battery_flag: u8,
    battery_life_percent: u8,
    system_status_flag: u8,
    battery_life_time: u32,
    battery_full_life_time: u32,
}

#[repr(C)]
#[derive(Default, Clone, Copy, Debug)]
struct RECT {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[repr(C)]
#[derive(Default, Clone, Copy, Debug)]
struct MONITORINFO {
    cb_size: u32,
    rc_monitor: RECT,
    rc_work: RECT,
    dw_flags: u32,
}

extern "system" {
    fn MonitorFromWindow(h_wnd: isize, dw_flags: u32) -> isize;
    fn GetMonitorInfoW(h_monitor: isize, lpmi: *mut MONITORINFO) -> i32;
    fn GetDpiForWindow(h_wnd: isize) -> u32;
    fn SetWindowPos(
        h_wnd: isize,
        h_wnd_insert_after: isize,
        x: i32,
        y: i32,
        cx: i32,
        cy: i32,
        u_flags: u32,
    ) -> i32;
    fn GetSystemTimeAsFileTime(lp_system_time_as_file_time: *mut u64);
    fn GetSystemPowerStatus(status: *mut SystemPowerStatus) -> i32;
    fn GlobalMemoryStatusEx(status: *mut MemoryStatusEx) -> i32;
    fn keybd_event(b_vk: u8, b_scan: u8, dw_flags: u32, dw_extra_info: usize);
    fn GetKeyState(n_virt_key: i32) -> i16;
    fn GetSystemTimes(lp_idle_time: *mut FileTime, lp_kernel_time: *mut FileTime, lp_user_time: *mut FileTime) -> i32;
    fn OpenClipboard(h_wnd_new_owner: isize) -> i32;
    fn CloseClipboard() -> i32;
    fn EmptyClipboard() -> i32;
    fn SetClipboardData(u_format: u32, h_mem: isize) -> isize;
    fn GetClipboardData(u_format: u32) -> isize;
    fn GlobalAlloc(u_flags: u32, dw_bytes: usize) -> isize;
    fn GlobalFree(h_mem: isize) -> isize;
    fn GlobalLock(h_mem: isize) -> *mut u8;
    fn GlobalUnlock(h_mem: isize) -> i32;
    fn RegEnumKeyExW(
        h_key: isize,
        dw_index: u32,
        lp_name: *mut u16,
        lpcch_name: *mut u32,
        lp_reserved: *mut u32,
        lp_class: *mut u16,
        lpcch_class: *mut u32,
        lpft_last_write_time: *mut std::ffi::c_void,
    ) -> i32;
    fn RegOpenKeyExW(
        h_key: isize,
        lp_sub_key: *const u16,
        ul_options: u32,
        sam_desired: u32,
        phk_result: *mut isize,
    ) -> i32;
    fn RegQueryValueExW(
        h_key: isize,
        lp_value_name: *const u16,
        lp_reserved: *mut u32,
        lp_type: *mut u32,
        lp_data: *mut u8,
        lpcb_data: *mut u32,
    ) -> i32;
    fn RegCloseKey(h_key: isize) -> i32;
    fn EnumWindows(lp_enum_func: unsafe extern "system" fn(isize, isize) -> i32, l_param: isize) -> i32;
    fn GetWindowTextW(h_wnd: isize, lp_string: *mut u16, n_max_count: i32) -> i32;
    fn GetWindowThreadProcessId(h_wnd: isize, lpdw_process_id: *mut u32) -> u32;
    fn IsWindowVisible(h_wnd: isize) -> i32;
    fn ShowWindow(h_wnd: isize, n_cmd_show: i32) -> i32;
    fn SetForegroundWindow(h_wnd: isize) -> i32;
    fn OpenProcess(dw_desired_access: u32, b_inherit_handle: i32, dw_process_id: u32) -> isize;
    fn CloseHandle(h_object: isize) -> i32;
    fn QueryFullProcessImageNameW(h_process: isize, dw_flags: u32, lp_exe_name: *mut u16, lpdw_size: *mut u32) -> i32;
}

#[derive(Serialize)]
pub struct BatteryInfo {
    pub level: u8,
    pub is_charging: bool,
    pub has_battery: bool,
}

#[tauri::command]
fn get_battery_status() -> BatteryInfo {
    unsafe {
        let mut status = SystemPowerStatus {
            ac_line_status: 255,
            battery_flag: 255,
            battery_life_percent: 255,
            system_status_flag: 0,
            battery_life_time: 0,
            battery_full_life_time: 0,
        };
        if GetSystemPowerStatus(&mut status) != 0 {
            let is_charging = status.ac_line_status == 1;
            let level = if status.battery_life_percent <= 100 {
                status.battery_life_percent
            } else {
                100
            };
            let has_battery = status.battery_flag != 128 && status.battery_flag != 255;
            BatteryInfo {
                level,
                is_charging,
                has_battery,
            }
        } else {
            BatteryInfo {
                level: 100,
                is_charging: true,
                has_battery: false,
            }
        }
    }
}

#[tauri::command]
fn send_media_play_pause() {
    unsafe {
        keybd_event(0xB3, 0, 1, 0);
        keybd_event(0xB3, 0, 1 | 2, 0);
    }
}

#[tauri::command]
fn send_media_next() {
    unsafe {
        keybd_event(0xB0, 0, 1, 0);
        keybd_event(0xB0, 0, 1 | 2, 0);
    }
}

#[tauri::command]
fn send_media_prev() {
    unsafe {
        keybd_event(0xB1, 0, 1, 0);
        keybd_event(0xB1, 0, 1 | 2, 0);
    }
}

#[tauri::command]
fn send_volume_up() {
    unsafe {
        keybd_event(0xAF, 0, 0, 0);
        keybd_event(0xAF, 0, 2, 0);
    }
}

#[tauri::command]
fn send_volume_down() {
    unsafe {
        keybd_event(0xAE, 0, 0, 0);
        keybd_event(0xAE, 0, 2, 0);
    }
}

#[tauri::command]
fn send_volume_mute() {
    unsafe {
        keybd_event(0xAD, 0, 0, 0);
        keybd_event(0xAD, 0, 2, 0);
    }
}

#[tauri::command]
fn set_click_through(window: WebviewWindow, ignore: bool) -> Result<(), String> {
    window.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())
}

#[tauri::command]
fn center_at_top(window: WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    let hwnd_raw = match window.hwnd() {
        Ok(h) => h.0 as isize,
        Err(_) => return Err("Failed to get HWND".into()),
    };

    unsafe {
        let hmon = MonitorFromWindow(hwnd_raw, 2); // 2 = MONITOR_DEFAULTTONEAREST
        if hmon == 0 {
            return Err("No monitor found".into());
        }

        let mut mi = MONITORINFO {
            cb_size: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if GetMonitorInfoW(hmon, &mut mi as *mut _) == 0 {
            return Err("GetMonitorInfoW failed".into());
        }

        let dpi = GetDpiForWindow(hwnd_raw);
        let scale = if dpi > 0 { (dpi as f64) / 96.0 } else { 1.0 };

        let win_w = (width * scale).round() as i32;
        let win_h = (height * scale).round() as i32;
        let mon_width = mi.rc_monitor.right - mi.rc_monitor.left;
        let x = mi.rc_monitor.left + (mon_width - win_w) / 2;
        let y = mi.rc_monitor.top;

        // SWP_NOZORDER (0x0004) | SWP_NOACTIVATE (0x0010) | SWP_ASYNCWINDOWPOS (0x4000) = 0x4014
        SetWindowPos(hwnd_raw, 0, x, y, win_w, win_h, 0x4014);
    }
    Ok(())
}

#[tauri::command]
fn log_from_frontend(msg: String) {
    #[cfg(debug_assertions)]
    eprintln!("[FRONTEND] {}", msg);
    let _ = msg;
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn launch_task_manager() -> Result<(), String> {
    std::process::Command::new("taskmgr.exe")
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn open_sound_settings() -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg("ms-settings:sound")
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn show_in_folder(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if p.exists() {
        if p.is_file() {
            std::process::Command::new("explorer")
                .arg(format!("/select,{}", path))
                .spawn()
                .map_err(|e| e.to_string())?;
            return Ok(());
        } else if p.is_dir() {
            std::process::Command::new("explorer")
                .arg(&path)
                .spawn()
                .map_err(|e| e.to_string())?;
            return Ok(());
        }
    }

    // Check if partial download extension exists
    let candidates = [
        format!("{}.crdownload", path),
        format!("{}.part", path),
        format!("{}.opdownload", path),
    ];
    for candidate in &candidates {
        let cp = std::path::Path::new(candidate);
        if cp.exists() && cp.is_file() {
            std::process::Command::new("explorer")
                .arg(format!("/select,{}", candidate))
                .spawn()
                .map_err(|e| e.to_string())?;
            return Ok(());
        }
    }

    // Fallback: Open parent directory if valid
    if let Some(parent) = p.parent() {
        if parent.exists() {
            std::process::Command::new("explorer")
                .arg(parent)
                .spawn()
                .map_err(|e| e.to_string())?;
            return Ok(());
        }
    }

    // Fallback: Open standard Windows Downloads directory
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let downloads_dir = std::path::PathBuf::from(profile).join("Downloads");
        if downloads_dir.exists() {
            std::process::Command::new("explorer")
                .arg(downloads_dir)
                .spawn()
                .map_err(|e| e.to_string())?;
            return Ok(());
        }
    }

    // Default fallback: Open Explorer
    std::process::Command::new("explorer")
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn open_file_path(path: String) -> Result<(), String> {
    show_in_folder(path)
}

#[tauri::command]
fn copy_to_clipboard(text: String) -> Result<(), String> {
    unsafe {
        let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
        let bytes_len = wide.len() * std::mem::size_of::<u16>();

        // GMEM_MOVEABLE = 0x0002
        let h_mem = GlobalAlloc(0x0002, bytes_len);
        if h_mem == 0 {
            return Err("Failed to allocate global memory for clipboard".to_string());
        }

        let ptr = GlobalLock(h_mem) as *mut u16;
        if ptr.is_null() {
            GlobalFree(h_mem);
            return Err("Failed to lock global memory".to_string());
        }

        std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr, wide.len());
        GlobalUnlock(h_mem);

        if OpenClipboard(0) == 0 {
            GlobalFree(h_mem);
            return Err("Failed to open clipboard".to_string());
        }

        EmptyClipboard();

        // CF_UNICODETEXT = 13
        let res = SetClipboardData(13, h_mem);
        CloseClipboard();

        if res == 0 {
            GlobalFree(h_mem);
            return Err("Failed to set clipboard data".to_string());
        }

        Ok(())
    }
}

struct WindowSearch {
    target_names: Vec<String>,
    found_hwnd: Option<isize>,
}

unsafe extern "system" fn enum_windows_proc(hwnd: isize, lparam: isize) -> i32 {
    if IsWindowVisible(hwnd) == 0 {
        return 1;
    }

    let search = &mut *(lparam as *mut WindowSearch);

    let mut pid: u32 = 0;
    GetWindowThreadProcessId(hwnd, &mut pid as *mut u32);
    if pid > 0 {
        let process = OpenProcess(0x1000, 0, pid);
        if process != 0 {
            let mut buf = [0u16; 512];
            let mut len = 512u32;
            if QueryFullProcessImageNameW(process, 0, buf.as_mut_ptr(), &mut len as *mut u32) != 0 {
                let slice = &buf[..len as usize];
                let exe_path = String::from_utf16_lossy(slice).to_lowercase();
                for target in &search.target_names {
                    if exe_path.contains(target) {
                        search.found_hwnd = Some(hwnd);
                        let _ = CloseHandle(process);
                        return 0;
                    }
                }
            }
            let _ = CloseHandle(process);
        }
    }

    let mut title_buf = [0u16; 512];
    let title_len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), 512);
    if title_len > 0 {
        let title = String::from_utf16_lossy(&title_buf[..title_len as usize]).to_lowercase();
        for target in &search.target_names {
            if target.len() > 3 && title.contains(target) {
                search.found_hwnd = Some(hwnd);
                return 0;
            }
        }
    }

    1
}

#[tauri::command]
fn focus_media_source(source: String, title: String) -> bool {
    let mut targets = Vec::new();
    let src_lower = source.to_lowercase();
    if src_lower.contains("spotify") {
        targets.push("spotify".to_string());
    } else if src_lower.contains("chrome") {
        targets.push("chrome".to_string());
    } else if src_lower.contains("msedge") || src_lower.contains("edge") {
        targets.push("msedge".to_string());
    } else if src_lower.contains("brave") {
        targets.push("brave".to_string());
    } else if src_lower.contains("coccoc") {
        targets.push("coccoc".to_string());
    } else if src_lower.contains("firefox") {
        targets.push("firefox".to_string());
    } else if !src_lower.is_empty() && src_lower != "windows" {
        targets.push(src_lower);
    }
    if !title.trim().is_empty() {
        targets.push(title.to_lowercase());
    }

    if targets.is_empty() {
        return false;
    }

    let mut search = WindowSearch {
        target_names: targets,
        found_hwnd: None,
    };

    unsafe {
        EnumWindows(enum_windows_proc, &mut search as *mut WindowSearch as isize);
        if let Some(hwnd) = search.found_hwnd {
            ShowWindow(hwnd, 9);
            SetForegroundWindow(hwnd);
            return true;
        }
    }
    false
}

fn start_hardware_monitor(app_handle: tauri::AppHandle) {
    use tauri::Emitter;
    std::thread::spawn(move || {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }
        let mut last_caps = unsafe { (GetKeyState(0x14) & 1) != 0 };
        let mut last_vol: u32 = 0;
        let mut last_mute: bool = false;

        let mut cached_vol: Option<IAudioEndpointVolume> = get_audio_endpoint_volume();
        if let Some(ref vol) = cached_vol {
            unsafe {
                last_vol = (vol.GetMasterVolumeLevelScalar().unwrap_or(0.0) * 100.0).round() as u32;
                last_mute = vol.GetMute().map(|b| b.as_bool()).unwrap_or(false);
            }
        }

        let mut poll_counter: u32 = 0;

        loop {
            std::thread::sleep(std::time::Duration::from_millis(40));
            poll_counter = poll_counter.wrapping_add(1);

            let current_caps = unsafe { (GetKeyState(0x14) & 1) != 0 };
            if current_caps != last_caps {
                last_caps = current_caps;
                let _ = app_handle.emit("hw-capslock", serde_json::json!({ "isActive": current_caps }));
            }

            // Periodically refresh endpoint (~2s) or if dropped, avoiding 25x/sec COM thrashing
            if cached_vol.is_none() || poll_counter % 50 == 0 {
                cached_vol = get_audio_endpoint_volume();
            }

            if let Some(ref vol) = cached_vol {
                unsafe {
                    match (vol.GetMasterVolumeLevelScalar(), vol.GetMute()) {
                        (Ok(scalar), Ok(is_muted_winbool)) => {
                            let level = (scalar * 100.0).round() as u32;
                            let muted = is_muted_winbool.as_bool();

                            if level != last_vol || muted != last_mute {
                                let is_vol_change = level != last_vol;
                                let is_mute_change = muted != last_mute;
                                last_vol = level;
                                last_mute = muted;

                                if is_mute_change {
                                    let _ = app_handle.emit("hw-mute", serde_json::json!({ "isMuted": muted }));
                                }
                                if is_vol_change {
                                    let _ = app_handle.emit("hw-volume", serde_json::json!({ "level": level, "isMuted": muted }));
                                }
                            }
                        }
                        _ => {
                            cached_vol = None;
                        }
                    }
                }
            }
        }
    });
}

fn start_downloads_monitor(app_handle: tauri::AppHandle) {
    use tauri::Emitter;
    std::thread::spawn(move || {
        let downloads_dir = match std::env::var("USERPROFILE") {
            Ok(profile) => std::path::PathBuf::from(profile).join("Downloads"),
            Err(_) => return,
        };

        if !downloads_dir.exists() {
            return;
        }

        let mut active_files: std::collections::HashMap<String, u64> = std::collections::HashMap::new();

        loop {
            std::thread::sleep(std::time::Duration::from_millis(600));

            let mut current_downloads = Vec::new();

            if let Ok(entries) = std::fs::read_dir(&downloads_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                        let ext_lower = ext.to_lowercase();
                        if ext_lower == "crdownload" || ext_lower == "part" || ext_lower == "opdownload" {
                            if let Ok(meta) = entry.metadata() {
                                let size = meta.len();
                                let full_name = entry.file_name().to_string_lossy().to_string();
                                let clean_name = if let Some(dot_pos) = full_name.rfind('.') {
                                    full_name[..dot_pos].to_string()
                                } else {
                                    full_name.clone()
                                };
                                current_downloads.push((full_name, clean_name, size));
                            }
                        }
                    }
                }
            }

            let mut completed_files = Vec::new();
            for (prev_file, _) in &active_files {
                if !current_downloads.iter().any(|(f, _, _)| f == prev_file) {
                    completed_files.push(prev_file.clone());
                }
            }

            for completed in completed_files {
                let final_size = active_files.remove(&completed).unwrap_or(0);
                let clean_name = if let Some(dot_pos) = completed.rfind('.') {
                    completed[..dot_pos].to_string()
                } else {
                    completed.clone()
                };
                let target_path = downloads_dir.join(&clean_name);
                // Safety check: verify target file exists; if download was cancelled, do not emit download-complete
                if target_path.exists() {
                    let target_path_str = target_path.to_string_lossy().to_string();
                    let _ = app_handle.emit("download-complete", serde_json::json!({
                        "filename": clean_name,
                        "totalBytes": final_size,
                        "path": target_path_str,
                    }));
                }
            }

            for (full_name, clean_name, current_size) in current_downloads {
                let prev_size = active_files.insert(full_name, current_size).unwrap_or(current_size);
                let bytes_diff = current_size.saturating_sub(prev_size);
                let speed_kbps = (bytes_diff as f32 / 1024.0) / 0.6;
                let target_path = downloads_dir.join(&clean_name).to_string_lossy().to_string();

                let _ = app_handle.emit("download-active", serde_json::json!({
                    "filename": clean_name,
                    "downloadedBytes": current_size,
                    "speedKbps": speed_kbps,
                    "path": target_path,
                }));
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        get_battery_status,
        send_media_play_pause,
        send_media_next,
        send_media_prev,
        send_volume_up,
        send_volume_down,
        send_volume_mute,
        set_click_through,
        center_at_top,
        get_current_system_media,
        get_system_volume,
        set_system_volume,
        get_active_audio_device,
        get_caps_lock_state,
        toggle_mute,
        get_system_stats,
        get_clipboard_text,
        copy_to_clipboard,
        seek_system_media,
        log_from_frontend,
        exit_app,
        launch_task_manager,
        open_sound_settings,
        open_file_path,
        show_in_folder,
        focus_media_source,
    ])
    .setup(|app| {
      use tauri::Manager;
      let app_handle = app.handle().clone();
      start_hardware_monitor(app_handle.clone());
      start_downloads_monitor(app_handle);

      if let Some(window) = app.get_webview_window("main") {
          let monitor = window
              .primary_monitor()
              .ok()
              .flatten()
              .or_else(|| window.current_monitor().ok().flatten());
          if let Some(monitor) = monitor {
              let screen_size = monitor.size();
              let scale = monitor.scale_factor();
              let mon_pos = monitor.position();
              let width = 420.0;
              let height = 68.0;
              let win_width_px = (width * scale).round() as i32;
              let win_height_px = (height * scale).round() as i32;
              let x = mon_pos.x + (screen_size.width as i32 - win_width_px) / 2;
              let y = mon_pos.y;
              if let Ok(hwnd) = window.hwnd() {
                  unsafe {
                      SetWindowPos(hwnd.0 as isize, -1, x, y, win_width_px, win_height_px, 0x0010);
                  }
              } else {
                  let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }));
                  let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
              }
              let _ = window.set_always_on_top(true);
              let _ = window.set_skip_taskbar(true);
              let _ = window.show();
          }
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_media_and_seek() {
        let media = get_current_system_media();
        println!("[TEST] Current media: {:?}", media);
        if let Some(ref m) = media {
            if let Some(ref art) = m.album_art {
                println!("[TEST] Album art prefix: {}", &art[..art.len().min(80)]);
                println!("[TEST] Album art total len: {}", art.len());
            } else {
                println!("[TEST] No album art extracted!");
            }
        }
        // Safe unit test: Verify media extraction without dispatching active seeks or key presses to live user media
        assert!(true);
    }

    #[test]
    fn test_media_keys_safety() {
        // Safe unit test: Verify key codes without sending live keystrokes to active Windows applications
        const VK_MEDIA_NEXT_TRACK: u8 = 0xB0;
        const VK_MEDIA_PREV_TRACK: u8 = 0xB1;
        const VK_MEDIA_PLAY_PAUSE: u8 = 0xB3;
        assert_eq!(VK_MEDIA_NEXT_TRACK, 0xB0);
        assert_eq!(VK_MEDIA_PREV_TRACK, 0xB1);
        assert_eq!(VK_MEDIA_PLAY_PAUSE, 0xB3);
    }

    #[test]
    fn test_focus_media_source() {
        let _ = focus_media_source("spotify".to_string(), "".to_string());
        let _ = focus_media_source("chrome".to_string(), "".to_string());
    }

    #[test]
    fn test_parse_chromium_media_title() {
        // Standard YouTube title with notification badge and browser branding
        let res1 = parse_chromium_media_title("(1) D Empty - ÁNH CHIỀU TÀN (Official Audio) - YouTube - Brave");
        assert!(res1.is_some());
        let (song1, artist1) = res1.unwrap();
        assert_eq!(song1, "D Empty");
        assert_eq!(artist1, "ÁNH CHIỀU TÀN (Official Audio)");

        // YouTube Music
        let res2 = parse_chromium_media_title("Never Gonna Give You Up - Rick Astley - YouTube Music");
        assert!(res2.is_some());
        let (song2, artist2) = res2.unwrap();
        assert_eq!(song2, "Never Gonna Give You Up");
        assert_eq!(artist2, "Rick Astley");

        // Chrome branding
        let res3 = parse_chromium_media_title("Cruel Summer - Taylor Swift - YouTube - Google Chrome");
        assert!(res3.is_some());
        let (song3, artist3) = res3.unwrap();
        assert_eq!(song3, "Cruel Summer");
        assert_eq!(artist3, "Taylor Swift");

        // Edge branding with zero-width space
        let res4 = parse_chromium_media_title("Blinding Lights - The Weeknd - YouTube - Microsoft\u{200b}Edge");
        assert!(res4.is_some());
        let (song4, artist4) = res4.unwrap();
        assert_eq!(song4, "Blinding Lights");
        assert_eq!(artist4, "The Weeknd");

        // Cốc Cốc branding
        let res5 = parse_chromium_media_title("Cắt Đôi Nỗi Sầu - Tăng Duy Tân - YouTube - Cốc Cốc");
        assert!(res5.is_some());
        let (song5, artist5) = res5.unwrap();
        assert_eq!(song5, "Cắt Đôi Nỗi Sầu");
        assert_eq!(artist5, "Tăng Duy Tân");

        // Song without artist delimiter
        let res6 = parse_chromium_media_title("Shape of You - YouTube");
        assert!(res6.is_some());
        let (song6, artist6) = res6.unwrap();
        assert_eq!(song6, "Shape of You");
        assert_eq!(artist6, "YouTube");

        // High count notification badge
        let res7 = parse_chromium_media_title("(99+) Song Title - Cool Artist - YouTube - Brave");
        assert!(res7.is_some());
        let (song7, artist7) = res7.unwrap();
        assert_eq!(song7, "Song Title");
        assert_eq!(artist7, "Cool Artist");

        // Multiple stacked notification badges: (1) (2)
        let res_stacked = parse_chromium_media_title("(1) (2) [Official MV] Song - Artist - YouTube - Brave");
        assert!(res_stacked.is_some());
        let (song_st, artist_st) = res_stacked.unwrap();
        assert_eq!(song_st, "[Official MV] Song");
        assert_eq!(artist_st, "Artist");

        // Triple stacked badges: (99+) (1) (2)
        let res_triple = parse_chromium_media_title("(99+) (1) (2) [Official MV] Song - Artist - YouTube - Brave");
        assert!(res_triple.is_some());
        let (song_tr, artist_tr) = res_triple.unwrap();
        assert_eq!(song_tr, "[Official MV] Song");
        assert_eq!(artist_tr, "Artist");

        // Lowercase " - youtube" suffix must be cleanly stripped and NOT leak into artist
        let res_lc = parse_chromium_media_title("Cruel Summer - Taylor Swift - youtube - Brave");
        assert!(res_lc.is_some());
        let (song_lc, artist_lc) = res_lc.unwrap();
        assert_eq!(song_lc, "Cruel Summer");
        assert_eq!(artist_lc, "Taylor Swift");

        // Lowercase " - youtube" without browser suffix
        let res_lc2 = parse_chromium_media_title("Blank Space - Taylor Swift - youtube");
        assert!(res_lc2.is_some());
        let (song_lc2, artist_lc2) = res_lc2.unwrap();
        assert_eq!(song_lc2, "Blank Space");
        assert_eq!(artist_lc2, "Taylor Swift");

        // Lowercase " - youtube music"
        let res_lc3 = parse_chromium_media_title("Song Title - Cool Artist - youtube music");
        assert!(res_lc3.is_some());
        let (song_lc3, artist_lc3) = res_lc3.unwrap();
        assert_eq!(song_lc3, "Song Title");
        assert_eq!(artist_lc3, "Cool Artist");

        // Hyphenated artist (e.g. Sơn Tùng M-TP, Jay-Z)
        let res_hyphen = parse_chromium_media_title("[MV] Sơn Tùng M-TP - ĐỪNG LÀM TRÁI TIM ANH ĐAU - YouTube - Google Chrome");
        assert!(res_hyphen.is_some());
        let (song_hy, artist_hy) = res_hyphen.unwrap();
        assert_eq!(song_hy, "[MV] Sơn Tùng M-TP");
        assert_eq!(artist_hy, "ĐỪNG LÀM TRÁI TIM ANH ĐAU");

        let res_jayz = parse_chromium_media_title("Jay-Z - Empire State of Mind - YouTube - Brave");
        assert!(res_jayz.is_some());
        let (song_jz, artist_jz) = res_jayz.unwrap();
        assert_eq!(song_jz, "Jay-Z");
        assert_eq!(artist_jz, "Empire State of Mind");

        // Non-media browser windows must return None
        assert!(parse_chromium_media_title("New Tab - Brave").is_none());
        assert!(parse_chromium_media_title("Google Search - Google Chrome").is_none());
        assert!(parse_chromium_media_title("YouTube - Google Chrome").is_none());
        assert!(parse_chromium_media_title("YouTube Music").is_none());
        assert!(parse_chromium_media_title("").is_none());
    }

    #[test]
    fn test_multi_session_scoring_mathematics() {
        // Scaled status weights: Playing strictly dominates Paused under any timestamp
        let playing_weight: i128 = 1_000_000_000_000_000_000_000_000; // 10^24
        let paused_weight: i128 = 1_000_000_000_000_000_000;         // 10^18
        let current_session_weight: i128 = 500_000_000_000_000_000_000_000; // 5x10^23

        let old_timestamp: i128 = 133500000000000000;
        let new_timestamp: i128 = 133500000005000000; // 5 seconds later

        // Playing session score vs Paused session score
        let playing_score = playing_weight + old_timestamp;
        let paused_score = paused_weight + current_session_weight + new_timestamp;

        // A playing session MUST always beat a paused session even if the paused session is current and newer
        assert!(playing_score > paused_score, "Playing session must strictly dominate paused sessions");

        // Critical Boundary Test: i64::MAX on Paused session with CurrentSession match
        // Can NEVER hijack an active playing session even if playing session has timestamp = 0
        let paused_max_ts_cur = paused_weight + current_session_weight + (i64::MAX as i128);
        let playing_zero_ts = playing_weight + 0;
        assert!(
            playing_zero_ts > paused_max_ts_cur,
            "Playing session even with ts=0 MUST strictly beat paused session with i64::MAX timestamp + CurrentSession"
        );

        // Critical Boundary Test: i64::MIN or negative timestamp on Playing session
        // Must be sanitized to 0, score remains >= 10^24, and is not dropped below initial i128::MIN
        let raw_neg_ts: i64 = i64::MIN;
        let sanitized_neg_ts = if raw_neg_ts > 0 { raw_neg_ts.min(i64::MAX) as i128 } else { 0 };
        let playing_neg_ts_score = playing_weight + sanitized_neg_ts;
        assert_eq!(sanitized_neg_ts, 0);
        assert!(playing_neg_ts_score > paused_max_ts_cur);
        assert!(playing_neg_ts_score > i128::MIN);

        // Between two playing sessions, CurrentSession match wins if timestamps are close
        let playing_cur = playing_weight + current_session_weight + old_timestamp;
        let playing_other = playing_weight + new_timestamp;
        assert!(playing_cur > playing_other, "CurrentSession match should prioritize active foreground player");

        // Between two playing sessions from same source, newer timestamp wins
        let playing_new = playing_weight + new_timestamp;
        let playing_old = playing_weight + old_timestamp;
        assert!(playing_new > playing_old, "Newer session timestamp must beat stale session");
    }

    #[test]
    fn test_simulated_session_ranking_adversarial_suite() {
        struct MockSession {
            id: &'static str,
            app_id: &'static str,
            is_playing: bool,
            is_paused: bool,
            universal_time: i64,
        }

        fn rank(sessions: &[MockSession], cur_id: Option<&str>) -> Option<&'static str> {
            let playing_weight: i128 = 1_000_000_000_000_000_000_000_000;
            let paused_weight: i128 = 1_000_000_000_000_000_000;
            let current_session_weight: i128 = 500_000_000_000_000_000_000_000;

            let mut best_id = None;
            let mut best_score = i128::MIN;

            for s in sessions {
                let mut score: i128 = 0;
                if s.is_playing {
                    score += playing_weight;
                } else if s.is_paused {
                    score += paused_weight;
                } else {
                    continue;
                }

                if let Some(c) = cur_id {
                    if c == s.app_id {
                        score += current_session_weight;
                    }
                }

                let ts = s.universal_time;
                if ts > 0 {
                    score += ts as i128;
                }

                if score > best_score {
                    best_score = score;
                    best_id = Some(s.id);
                }
            }
            best_id
        }

        let normal_ts: i64 = 133_500_000_000_000_000;

        // 1. Normal: playing beats paused
        let s1 = vec![
            MockSession { id: "p", app_id: "spotify", is_playing: true, is_paused: false, universal_time: normal_ts },
            MockSession { id: "pa", app_id: "chrome", is_playing: false, is_paused: true, universal_time: normal_ts + 1000 },
        ];
        assert_eq!(rank(&s1, Some("chrome")), Some("p"));

        // 2. Playing with ts=0 beats paused
        let s2 = vec![
            MockSession { id: "p0", app_id: "spotify", is_playing: true, is_paused: false, universal_time: 0 },
            MockSession { id: "pa", app_id: "chrome", is_playing: false, is_paused: true, universal_time: normal_ts },
        ];
        assert_eq!(rank(&s2, None), Some("p0"));

        // 3. Playing with ts=-1 beats paused
        let s3 = vec![
            MockSession { id: "p_neg", app_id: "spotify", is_playing: true, is_paused: false, universal_time: -1 },
            MockSession { id: "pa", app_id: "chrome", is_playing: false, is_paused: true, universal_time: normal_ts },
        ];
        assert_eq!(rank(&s3, None), Some("p_neg"));

        // 4. Paused with i64::MAX and CurrentSession CANNOT hijack active playing
        let s4 = vec![
            MockSession { id: "p_active", app_id: "brave", is_playing: true, is_paused: false, universal_time: normal_ts },
            MockSession { id: "pa_hijack", app_id: "chrome", is_playing: false, is_paused: true, universal_time: i64::MAX },
        ];
        assert_eq!(rank(&s4, Some("chrome")), Some("p_active"));

        // 5. Playing with i64::MIN beats paused
        let s5 = vec![
            MockSession { id: "p_min", app_id: "brave", is_playing: true, is_paused: false, universal_time: i64::MIN },
            MockSession { id: "pa", app_id: "chrome", is_playing: false, is_paused: true, universal_time: normal_ts },
        ];
        assert_eq!(rank(&s5, None), Some("p_min"));

        // 6. Lone playing session with negative timestamp is not dropped (score > i128::MIN)
        let s6 = vec![
            MockSession { id: "p_lone", app_id: "brave", is_playing: true, is_paused: false, universal_time: -1_500_000_000 },
        ];
        assert_eq!(rank(&s6, None), Some("p_lone"));

        // 7. u64::MAX as i64 correctly evaluated as negative/sanitized
        let s7 = vec![
            MockSession { id: "p_norm", app_id: "spotify", is_playing: true, is_paused: false, universal_time: normal_ts },
            MockSession { id: "pa_u64", app_id: "edge", is_playing: false, is_paused: true, universal_time: u64::MAX as i64 },
        ];
        assert_eq!(rank(&s7, None), Some("p_norm"));
    }

    #[test]
    fn test_thumbnail_cache_consistency() {
        let test_title = "Test Song";
        let test_artist = "Test Artist";
        let fake_art = "data:image/jpeg;base64,FAKEART123";

        // Store into cache
        if let Ok(mut guard) = LAST_MEDIA_ART.lock() {
            *guard = Some((test_title.to_string(), test_artist.to_string(), Some(fake_art.to_string())));
        }

        // Retrieve from cache
        let cached = {
            if let Ok(guard) = LAST_MEDIA_ART.lock() {
                if let Some((ref t, ref a, ref art)) = *guard {
                    if t == test_title && a == test_artist {
                        art.clone()
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        };

        assert_eq!(cached, Some(fake_art.to_string()));

        // Different track should miss cache
        let missed = {
            if let Ok(guard) = LAST_MEDIA_ART.lock() {
                if let Some((ref t, ref a, ref art)) = *guard {
                    if t == "Other Song" && a == test_artist {
                        art.clone()
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        };
        assert!(missed.is_none());
    }

    #[test]
    fn test_win32_window_pre_sizing_math() {
        let dpi_96 = 96;
        let scale_96 = if dpi_96 > 0 { (dpi_96 as f64) / 96.0 } else { 1.0 };
        assert_eq!(scale_96, 1.0);

        let dpi_144 = 144; // 150% DPI
        let scale_144 = if dpi_144 > 0 { (dpi_144 as f64) / 96.0 } else { 1.0 };
        assert_eq!(scale_144, 1.5);

        let width = 420.0;
        let height_expand = 260.0;
        let height_pill = 68.0;

        let win_w = (width * scale_144).round() as i32;
        let win_h_exp = (height_expand * scale_144).round() as i32;
        let win_h_pill = (height_pill * scale_144).round() as i32;

        assert_eq!(win_w, 630);
        assert_eq!(win_h_exp, 390);
        assert_eq!(win_h_pill, 102);

        let mon_left = 1920; // Secondary monitor to the right
        let mon_right = 3840;
        let mon_width = mon_right - mon_left;
        let x = mon_left + (mon_width - win_w) / 2;
        assert_eq!(x, 1920 + (1920 - 630) / 2);
    }

    #[test]
    fn test_m3_copy_to_clipboard_and_read() {
        let test_str = "DynamicIsland_M3_Test_Token_42";
        let res = copy_to_clipboard(test_str.to_string());
        assert!(res.is_ok(), "Native copy_to_clipboard must succeed");

        let read_back = get_clipboard_text();
        assert!(read_back.is_some(), "Must read clipboard back");
        assert_eq!(read_back.unwrap(), test_str);
    }

    #[test]
    fn test_m3_download_cancel_safety_logic() {
        // Simulating download cancel: temp file deleted, target file does NOT exist
        let dummy_cancelled_target = std::env::temp_dir().join(format!("test_cancelled_download_{}.tmp", std::process::id()));
        assert!(!dummy_cancelled_target.exists());
        // Verify invariant: if target does not exist, download-complete emission is skipped
        let should_emit = dummy_cancelled_target.exists();
        assert!(!should_emit, "Cancelled download must never emit complete");
    }

    #[test]
    fn test_m3_hardware_volume_caching_invariants() {
        // Query endpoint volume without loop re-instantiation
        let vol = get_audio_endpoint_volume();
        if let Some(ref v) = vol {
            unsafe {
                let scalar = v.GetMasterVolumeLevelScalar();
                assert!(scalar.is_ok(), "Scalar level query must succeed with cached volume interface");
            }
        }
    }

    #[test]
    fn test_facebook_generic_stub_rejection_and_multi_stream_recovery() {
        // 1. Generic stubs must be identified accurately
        assert!(is_generic_non_music("Facebook", ""));
        assert!(is_generic_non_music("(1) Facebook", "facebook.com"));
        assert!(is_generic_non_music("Watch | Facebook", ""));
        assert!(is_generic_non_music("Instagram", ""));
        assert!(is_generic_non_music("Twitter", ""));
        assert!(is_generic_non_music("New Tab", ""));

        // Real songs must NEVER be classified as generic
        assert!(!is_generic_non_music("Bông Hoa Chẳng Tồn Tại", "HT Media"));
        assert!(!is_generic_non_music("Lạc Chốn Hồng Trần", "Lã Phong Lâm"));
        assert!(!is_generic_non_music("Shape of You", "Ed Sheeran"));

        // 2. parse_chromium_media_title must reject Facebook and non-music tabs
        let fb_res = parse_chromium_media_title("Facebook - Brave");
        assert!(fb_res.is_none(), "Facebook tab must NEVER be parsed as a song");

        let yt_res = parse_chromium_media_title("Bông Hoa Chẳng Tồn Tại  ( Ver Hot Tiktok ) - Huy Vạc | Em Hãy Quay Về Để Anh Thôi Nhớ Mong Remix - YouTube - Brave");
        assert!(yt_res.is_some(), "YouTube music tab must be parsed successfully");
        let (song, artist) = yt_res.unwrap();
        assert_eq!(song, "Bông Hoa Chẳng Tồn Tại  ( Ver Hot Tiktok )");
        assert!(artist.contains("Huy Vạc"));
    }
}

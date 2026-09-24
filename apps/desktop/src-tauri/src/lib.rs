use tauri::{Emitter, Manager};

/// PGN files handed to the app by the OS ("Open with MainLine", double-click, drag onto the icon).
#[derive(Clone, serde::Serialize)]
struct OpenedFile {
    name: String,
    text: String,
}

fn emit_pgn_files(app: &tauri::AppHandle, paths: impl IntoIterator<Item = std::path::PathBuf>) {
    for path in paths {
        let is_pgn = path.extension().map(|e| e.eq_ignore_ascii_case("pgn")).unwrap_or(false);
        if !is_pgn {
            continue;
        }
        if let Ok(text) = std::fs::read_to_string(&path) {
            let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            let _ = app.emit("mainline://open-file", OpenedFile { name, text });
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())?;
            }
            // Windows/Linux pass files as launch arguments.
            let handle = app.handle().clone();
            let args: Vec<std::path::PathBuf> = std::env::args().skip(1).map(std::path::PathBuf::from).collect();
            emit_pgn_files(&handle, args);
            // Register mainline:// at runtime on Windows/Linux dev builds (bundles register it at install).
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building MainLine");

    app.run(|handle, event| {
        // macOS delivers opened files as an event.
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        if let tauri::RunEvent::Opened { urls } = &event {
            let paths = urls.iter().filter_map(|u| u.to_file_path().ok());
            emit_pgn_files(handle, paths);
            if let Some(w) = handle.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }
        let _ = (handle, &event);
    });
}

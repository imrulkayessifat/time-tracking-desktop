import psutil
from pywinauto import Application, findwindows

def get_firefox_url():
    try:
        windows = findwindows.find_elements(title_re=".*Mozilla Firefox.*")
        if windows:
            process_id = windows[0].process_id
            if "firefox" in psutil.Process(process_id).name().lower():
                app = Application(backend='uia').connect(process=process_id)
                return app.window(title_re=".*Mozilla Firefox.*").child_window(auto_id="urlbar-input", control_type="Edit").get_value()
    except Exception:
        pass
    return None        

if __name__ == "__main__":
    url = get_firefox_url()
    if url:
        print(f"{url}")
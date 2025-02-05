from pywinauto import Application

# List of supported browsers with window title keywords
BROWSERS = {
    "chrome": ".*Chrome.*",
}

def get_browser():
    """Detect which browser is running and return its application object."""
    for browser, title in BROWSERS.items():
        try:
            return Application(backend='uia').connect(title_re=title), browser
        except:
            continue
    return None, None

def get_current_url():
    app, browser_name = get_browser()
    if not app:
        print("No supported browser found!")
        return

    dlg = app.top_window()
    element_name = "Address and search bar"

    try:
        url = dlg.child_window(title=element_name, control_type="Edit").get_value()
        return url
    except Exception as e:
        print(f"Error: {e}")
        return None

if _name_ == "__main__":
    url = get_current_url()
    if url:
        print(f"Current URL: {url}")
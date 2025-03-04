# import time
# import sys
# from pywinauto import Application

# # List of supported browsers with window title keywords
# BROWSERS = {
#     "chrome": ".*Chrome.*",
# }

# def get_browser():
#     """Detect which browser is running and return its application object."""
#     for browser, title in BROWSERS.items():
#         try:
#             return Application(backend='uia').connect(title_re=title), browser
#         except:
#             continue
#     return None, None

# def track_url_time():
#     app, browser_name = get_browser()
#     if not app:
#         print("No supported browser found!", file=sys.stderr)
#         return
#     sys.stdout.flush()

#     dlg = app.top_window()
#     element_name = "Address and search bar"
#     try:
#         url = dlg.child_window(title=element_name, control_type="Edit").get_value()
        
#         return url

#     except Exception as e:
#             print(f"Error: {e}", file=sys.stderr)

# if __name__ == "__main__":
#     url = track_url_time()
#     if url:
#         print(url)
import uiautomation as auto

def get_firefox_address_bar(window_index=1):
    """Get Firefox browser address bar control."""
    return (auto.Control(Depth=1, ClassName='MozillaWindowClass', foundIndex=window_index)
            .ToolBarControl(AutomationId='nav-bar')
            .ComboBoxControl(Depth=1, foundIndex=1)
            .EditControl(Depth=1, foundIndex=1))

def get_edge_address_bar(win_pane, window_index=1):
    """Get Edge browser address bar control."""
    return (win_pane.PaneControl(Depth=1, foundIndex=1)
            .PaneControl(Depth=1, foundIndex=2)
            .PaneControl(Depth=1, foundIndex=1)
            .ToolBarControl(Depth=1, foundIndex=1))

def get_opera_address_bar(win_pane, window_index=1):
    """Get Opera browser address bar control."""
    return (win_pane.GroupControl(Depth=1, foundIndex=1)
            .PaneControl(Depth=1, foundIndex=1)
            .PaneControl(Depth=1, foundIndex=2)
            .GroupControl(Depth=1, foundIndex=1)
            .GroupControl(Depth=1, foundIndex=1)
            .ToolBarControl(Depth=1, foundIndex=1)
            .EditControl(Depth=1, foundIndex=1))

def get_chrome_address_bar(win_pane):
    """Get Chrome browser address bar control."""
    addr_pane = (win_pane.PaneControl(Depth=1, foundIndex=2)
                .PaneControl(Depth=1, foundIndex=1)
                .PaneControl(Depth=1, Compare=lambda control, _depth:
                    control.GetFirstChildControl() and 
                    control.GetFirstChildControl().ControlTypeName == 'ButtonControl'))
    return addr_pane.GroupControl(Depth=1, foundIndex=1).EditControl(Depth=1)

def get_browser_address_bar(browser_name='Google Chrome', window_index=1):
    """
    Get browser address bar control based on browser name.
    
    Args:
        browser_name (str): Browser name ('Google Chrome', 'Firefox', 'Edge', 'Opera')
        window_index (int): Window index counting from back to front (default=1)
    
    Returns:
        UIAutomation Control object for the address bar
    """
    if browser_name == 'Firefox':
        return get_firefox_address_bar(window_index)
    
    # For Chrome-based browsers
    win = auto.Control(Depth=1, ClassName='Chrome_WidgetWin_1', SubName=browser_name, foundIndex=window_index)
    win_pane = win.PaneControl(Depth=1, Compare=lambda control, _depth: control.Name != '')
    
    if browser_name == 'Edge':
        addr_bar = get_edge_address_bar(win_pane, window_index)
    elif browser_name == 'Opera':
        addr_bar = get_opera_address_bar(win_pane, window_index)
    else:  # Chrome
        addr_bar = get_chrome_address_bar(win_pane)
    
    assert addr_bar is not None
    return addr_bar

def get_current_url(browser_name='Google Chrome', window_index=1):
    """
    Get current URL from the browser.
    
    Args:
        browser_name (str): Browser name
        window_index (int): Window index
    
    Returns:
        str: Current URL in the address bar
    """
    addr_bar = get_browser_address_bar(browser_name, window_index)
    return addr_bar.GetValuePattern().Value

def set_current_url(url, browser_name='Google Chrome', window_index=1):
    """
    Set URL in the browser's address bar.
    
    Args:
        url (str): URL to set
        browser_name (str): Browser name
        window_index (int): Window index
    """
    addr_bar = get_browser_address_bar(browser_name, window_index)
    addr_bar.GetValuePattern().SetValue(url)

# Example usage
if __name__ == "__main__":
    # Get current URL
    current_url = get_current_url('Google Chrome')
    print(f"Current URL: {current_url}")
    

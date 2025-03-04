import uiautomation as auto

def get_firefox_url():
    # Find the Firefox window
    firefox = auto.WindowControl(searchDepth=1, ClassName='MozillaWindowClass')
    
    if not firefox.Exists(0, 0):
        print("Firefox is not running")
        return None
    
    # Find the address bar
    address_bar = firefox.EditControl(AutomationId='urlbar-input')
    
    if not address_bar.Exists(0, 0):
        print("Address bar not found")
        return None
    
    return address_bar.GetValuePattern().Value

# Get and print the URL
url = get_firefox_url()
if url:
    print(url)

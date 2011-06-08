from xml.dom.minidom import Document
import simplejson as json

def parse_options(options):
    
    doc = Document()
    root = doc.createElement("vbox")
    root.setAttribute("xmlns", "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul")
    doc.appendChild(root)

    for pref_name in options:
        pref = options[pref_name]
        setting = doc.createElement("setting")
        setting.setAttribute("pref", "extensions.dummyaddon."+pref_name)
        setting.setAttribute("type", pref["type"])
        setting.setAttribute("title", pref["title"]) 

        if (pref["type"] == "button"):
            setting.setAttribute("type", "control")
            button = doc.createElement("button")
            button.setAttribute("label", pref["label"])
            setting.appendChild(button)

        root.appendChild(setting)

    return doc.toprettyxml(indent="  ")

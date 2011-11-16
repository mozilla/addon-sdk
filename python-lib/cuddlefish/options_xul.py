from xml.dom.minidom import Document
import simplejson as json

def parse_options(options, jetpack_id):

    doc = Document()
    root = doc.createElement("vbox")
    root.setAttribute("xmlns", "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul")
    doc.appendChild(root)

    for pref_name in options:
        pref = options[pref_name]
        setting = doc.createElement("setting")
        setting.setAttribute("pref", "extensions." + jetpack_id+"." + pref_name)
        setting.setAttribute("type", pref["type"])
        setting.setAttribute("title", pref["title"])

        if (pref["type"] == "button"):
            setting.setAttribute("type", "control")
            button = doc.createElement("button")
            button.setAttribute("label", pref["label"])
            button.setAttribute("oncommand","Services.obs.notifyObservers(null, '"+
                                              jetpack_id+"-cmdPressed', '"+
                                              pref_name+"');");
            setting.appendChild(button)
        elif (pref["type"] == "boolint"):
            setting.setAttribute("on", pref["on"])
            setting.setAttribute("off", pref["off"])

        root.appendChild(setting)

    return doc.toprettyxml(indent="  ")

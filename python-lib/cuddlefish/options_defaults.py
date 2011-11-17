def parse_options_defaults(options, jetpack_id):
    pref_list = []

    for pref_name in options:
        pref = options[pref_name]
        if ('value' in pref):
            value = pref["value"]
            vtype = str(type(value))

            if ("<type 'bool'>" == vtype):
                value = str(pref["value"]).lower()
            elif ("<type 'str'>" == vtype):
                value = "\"" + str(pref["value"]) + "\""
            elif ("<type 'unicode'>" == vtype):
                value = "\"" + str(pref["value"]) + "\""
            else:
                value = str(pref["value"])

            pref_list.append("pref(\"extensions." + jetpack_id + "." + pref_name + "\", " + value + ");")

    return "\n".join(pref_list) + "\n"

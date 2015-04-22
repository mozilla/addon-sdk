/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const readID = require("jetpack-id/index");
const readVersion = require("mozilla-toolkit-versioning/index").parse;

const MIN_VERSION = "33.0a1";
const MAX_VERSION = "*";
const GUIDS = {
  FIREFOX: "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}",
  MOZILLA: "{86c18b42-e466-45a9-ae7a-9b95ba6f5640}",
  SUNBIRD: "{718e30fb-e89b-41dd-9da7-e25a45638b28}",
  SEAMONKEY: "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}",
  FENNEC: "{aa3c5121-dab2-40e2-81ca-7ea25febc110}",
  THUNDERBIRD: "{3550f703-e582-4d05-9a08-453d09bdfdc6}"
}


const readPreferences = manifest =>
  manifest.preferences &&
  `<em:optionsURL>data:text/xml,<placeholder/></em:optionsURL>
   <em:optionsType>2</em:optionsType>`;

const readUpdateURL = manifest =>
  manifest.updateURL && `<em:updateURL>${manifest.updateURL}</em:updateURL>`

const readUpdateKey = manifest =>
  manifest.updateKey && `<em:updateKey>${manifest.updateKey}</em:updateKey>`

const readDevelopers = manifest =>
  manifest.developers &&
  manifest.
    developers.
    map(devloper => `<em:developer>${devloper}</em:developer>`).
    join("\n");

const readTranslators = manifest =>
  manifest.translators &&
  manifest.
    translators.
    map(x => `<em:translator>${x}</em:translator>`).
    join("\n");

const readContributors = manifest =>
  manifest.contributors &&
  manifest.
    contributors.
    map(x => `<em:contributor>${x}</em:contributor>`).
    join("\n");

const readGUID = type => GUIDS[(type.toUpperCase())];

/**
 * Formats the package.json's `author` key to pull out the name
 * in the following formats, for use with the `em:creator` key in the
 * install.rdf:
 *
 * "Jordan Santell"
 * "Jordan Santell <jsantell@mozilla.com>"
 * { name: "Jordan Santell", email: "jsantell@mozilla.com" }
 */
const readAuthor = ({author}) => {
  if (typeof author === "object") {
    return (author.name || "").trim();
  }
  return author || "";
}

const readEngine = (name, versions) => {
  // If `versions` exists, parse it, otherwise assume defaults
  const {min, max} = versions ? readVersion(versions) : {};

  return `<em:targetApplication>
            <Description>
              <em:id>${readGUID(name)}</em:id>
              <em:minVersion>${min || MIN_VERSION}</em:minVersion>
              <em:maxVersion>${max || MAX_VERSION}</em:maxVersion>
            </Description>
          </em:targetApplication>`
}

const readEngines = manifest => {
  const names = Object.keys(manifest.engines || {});
  return names.length ? names.map(name => readEngine(name, manifest.engines[name])) :
         readEngine("Firefox")
}



const readManifest = manifest =>
  `<?xml version="1.0" encoding="utf-8"?>
  <RDF xmlns="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
       xmlns:em="http://www.mozilla.org/2004/em-rdf#">
    <Description about="urn:mozilla:install-manifest">
      <em:type>2</em:type>
      <em:bootstrap>true</em:bootstrap>
      <em:id>${readID(manifest)}</em:id>
      <em:version>${manifest.version || "0.0.0"}</em:version>
      <em:unpack>${manifest.unpack === true}</em:unpack>
      <em:name>${manifest.title || manifest.name || "Untitled"}</em:name>
      <em:description>${manifest.description || ""}</em:description>
      <em:homepageURL>${manifest.homepage || ""}</em:homepageURL>
      <em:creator>${readAuthor(manifest) || ""}</em:creator>
      <em:iconURL>${manifest.icon || "icon.png"}</em:iconURL>
      <em:icon64URL>${manifest.icon64 || "icon64.png"}</em:icon64URL>
      ${readPreferences(manifest) || ""}
      ${readUpdateURL(manifest) || ""}
      ${readUpdateKey(manifest) || ""}
      ${readDevelopers(manifest) || ""}
      ${readTranslators(manifest) || ""}
      ${readContributors(manifest) || ""}
      ${readEngines(manifest)}
    </Description>
  </RDF>`;
exports.readManifest = readManifest;

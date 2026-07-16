const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SWIFT_ID = 'E11748412D0307B40044C1D9';
const SWIFT_BUILD_ID = 'E11748422D0307B40044C1D9';
const OBJC_ID = 'E21748412D0307B40044C1D9';
const OBJC_BUILD_ID = 'E21748422D0307B40044C1D9';

function copyTemplate(template, destination) {
  fs.copyFileSync(path.join(__dirname, 'tap-to-pay-education', template), destination);
}

function addNativeSources(projectPath) {
  let project = fs.readFileSync(projectPath, 'utf8');
  if (project.includes('TapToPayEducation.swift')) return;

  project = project.replace(
    '/* End PBXBuildFile section */',
    `\t\t${SWIFT_BUILD_ID} /* TapToPayEducation.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${SWIFT_ID} /* TapToPayEducation.swift */; };\n\t\t${OBJC_BUILD_ID} /* TapToPayEducation.m in Sources */ = {isa = PBXBuildFile; fileRef = ${OBJC_ID} /* TapToPayEducation.m */; };\n/* End PBXBuildFile section */`,
  );
  project = project.replace(
    '/* End PBXFileReference section */',
    `\t\t${SWIFT_ID} /* TapToPayEducation.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = TapToPayEducation.swift; path = LPTicket/TapToPayEducation.swift; sourceTree = "<group>"; };\n\t\t${OBJC_ID} /* TapToPayEducation.m */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.objc; name = TapToPayEducation.m; path = LPTicket/TapToPayEducation.m; sourceTree = "<group>"; };\n/* End PBXFileReference section */`,
  );
  project = project.replace(
    'F11748442D0722820044C1D9 /* LPTicket-Bridging-Header.h */,',
    `F11748442D0722820044C1D9 /* LPTicket-Bridging-Header.h */,\n\t\t\t\t${SWIFT_ID} /* TapToPayEducation.swift */,\n\t\t\t\t${OBJC_ID} /* TapToPayEducation.m */,`,
  );
  project = project.replace(
    'F6574354C0E616F436559C9C /* ExpoModulesProvider.swift in Sources */,',
    `F6574354C0E616F436559C9C /* ExpoModulesProvider.swift in Sources */,\n\t\t\t\t${SWIFT_BUILD_ID} /* TapToPayEducation.swift in Sources */,\n\t\t\t\t${OBJC_BUILD_ID} /* TapToPayEducation.m in Sources */,`,
  );
  fs.writeFileSync(projectPath, project);
}

module.exports = function withTapToPayEducation(config) {
  return withDangerousMod(config, ['ios', async (nextConfig) => {
    const iosRoot = nextConfig.modRequest.platformProjectRoot;
    const targetRoot = path.join(iosRoot, 'LPTicket');
    const projectPath = path.join(iosRoot, 'LPTicket.xcodeproj', 'project.pbxproj');
    if (!fs.existsSync(targetRoot) || !fs.existsSync(projectPath)) return nextConfig;

    copyTemplate('TapToPayEducation.swift', path.join(targetRoot, 'TapToPayEducation.swift'));
    copyTemplate('TapToPayEducation.m', path.join(targetRoot, 'TapToPayEducation.m'));
    const bridgingHeader = path.join(targetRoot, 'LPTicket-Bridging-Header.h');
    if (fs.existsSync(bridgingHeader)) {
      const content = fs.readFileSync(bridgingHeader, 'utf8');
      if (!content.includes('RCTBridgeModule.h')) {
        fs.writeFileSync(bridgingHeader, `${content.trimEnd()}\n\n#import <React/RCTBridgeModule.h>\n`);
      }
    }
    addNativeSources(projectPath);
    return nextConfig;
  }]);
};

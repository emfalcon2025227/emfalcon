const fs = require('fs');
let file = fs.readFileSync('src/server-utils/googleDriveIntegrationService.ts', 'utf8');

const regex = /\/\/ Step 4: Root Archive Folder Check \("Emirates Falcon"\)[\s\S]*?steps\[3\] = \{\s*name: "Root Archive Folder Check",\s*status: "FAIL",\s*latency: Date\.now\(\) - t4,\s*details: \`تعذر التحقق من مجلد الأرشيف الرئيسي: \$\{err\.message\}\`,\s*\};[\s\S]*?safeErrorMessage: \`تعذر الوصول إلى مجلد الأرشيف الرئيسي \(\$\{rootFolderName\}\)\.\`,\s*\};\s*\}/m;

const replacement = `// Step 4: Root Archive Folder Check ("Emirates Falcon")
  const t4 = Date.now();
  let rootFolderId = config.rootFolderId || "";
  const rootFolderName = config.rootFolderName || "Emirates Falcon";
  try {
    // Only search, DO NOT CREATE
    const query = \`name = '\${rootFolderName}' and 'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false\`;
    const res = await driveClient.files.list({
      q: query,
      spaces: "drive",
      fields: "files(id, name)",
    });

    if (res.data.files && res.data.files.length > 0) {
      rootFolderId = res.data.files[0].id!;
      steps[3] = {
        name: "Root Archive Folder Check",
        status: "PASS",
        latency: Date.now() - t4,
        details: \`المجلد الرئيسي موجود ومتاح: "\${rootFolderName}" (\${rootFolderId})\`,
      };
    } else {
      steps[3] = {
        name: "Root Archive Folder Check",
        status: "FAIL",
        latency: Date.now() - t4,
        details: \`ROOT_FOLDER_NOT_FOUND\`,
      };
      return {
        success: false,
        status: "ERROR",
        latency: Date.now() - tStart,
        steps,
        safeErrorMessage: \`مجلد الأرشيف الرئيسي (\${rootFolderName}) غير موجود.\`,
        repairInstructions: "يرجى إنشاء المجلد (Emirates Falcon) يدوياً في حساب Google Drive المركزي.",
      };
    }
  } catch (err: any) {
    steps[3] = {
      name: "Root Archive Folder Check",
      status: "FAIL",
      latency: Date.now() - t4,
      details: \`تعذر التحقق من مجلد الأرشيف الرئيسي: \${err.message}\`,
    };
    return {
      success: false,
      status: "ERROR",
      latency: Date.now() - tStart,
      steps,
      safeErrorMessage: \`تعذر الوصول إلى مجلد الأرشيف الرئيسي (\${rootFolderName}).\`,
    };
  }`;

file = file.replace(regex, replacement);
fs.writeFileSync('src/server-utils/googleDriveIntegrationService.ts', file);
console.log("Patched drive root folder check.");

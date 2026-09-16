const fs = require('fs');
let file = fs.readFileSync('src/server-utils/googleDriveIntegrationService.ts', 'utf8');

const regex = /\/\/ Step 5: Archive Readability[\s\S]*?updateGoogleDriveConfig/m;

const replacement = `// Step 5: Archive Readability (harmless list files within root folder, limit 5)
  const t5 = Date.now();
  let fileList: any[] = [];
  try {
    const listRes = await driveClient.files.list({
      q: \`'\${rootFolderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'\`,
      spaces: "drive",
      fields: "files(id, name, mimeType)",
      pageSize: 5,
    });

    fileList = listRes.data.files || [];
    
    // Test getting file metadata if files exist (Real Preview test)
    if (fileList.length > 0) {
      const testFileId = fileList[0].id;
      await driveClient.files.get({
        fileId: testFileId,
        fields: "id, name, mimeType, size",
      });
      
      steps[4] = {
        name: "Archive Readability",
        status: "PASS",
        latency: Date.now() - t5,
        details: \`تم التحقق من قراءة محتويات المجلد واسترداد بيانات ملف موجود بنجاح (المحتويات المفهرسة: \${fileList.length} عنصر). لا يتم إنشاء ملفات وهمية.\`,
      };
    } else {
      steps[4] = {
        name: "Archive Readability",
        status: "PASS",
        latency: Date.now() - t5,
        details: \`تم التحقق من مجلد الأرشيف (فارغ حالياً، لا يوجد ملفات لاختبار التنزيل/المعاينة). لا يتم إنشاء ملفات وهمية.\`,
      };
    }
  } catch (err: any) {
    steps[4] = {
      name: "Archive Readability",
      status: "FAIL",
      latency: Date.now() - t5,
      details: \`فشل قراءة محتويات المجلد أو استرداد بيانات الملف: \${err.message}\`,
    };
    return {
      success: false,
      status: "ERROR",
      latency: Date.now() - tStart,
      steps,
      safeErrorMessage: "فشل التحقق من صلاحية قراءة الملفات في مجلد الأرشيف.",
    };
  }

  const totalLatency = Date.now() - tStart;

  // Persist updated verification state
  updateGoogleDriveConfig`;

file = file.replace(regex, replacement);
fs.writeFileSync('src/server-utils/googleDriveIntegrationService.ts', file);
console.log("Patched drive archive readability test.");

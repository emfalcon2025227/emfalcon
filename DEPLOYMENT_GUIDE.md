# GitHub Pages Deployment Guide

## 📋 نظرة عامة

هذا المستند يوضح كيفية نشر تطبيق React على GitHub Pages بشكل تلقائي باستخدام GitHub Actions.

## ✅ الخطوات المنجزة

### 1. إنشاء Workflow الـ Deployment
تم إنشاء ملف `.github/workflows/deploy.yml` الذي يقوم بـ:
- تثبيت المكتبات (`npm install`)
- بناء التطبيق (`npm run build`)
- نشر ملفات `dist/` على GitHub Pages تلقائياً

### 2. تحديث .gitignore
تم تحديث `.gitignore` للتأكد من عدم رفع:
- مجلد `node_modules/`
- مجلد `dist/` (سيتم إنشاؤه أثناء الـ Build)
- ملفات البيئة الحساسة

### 3. تحديث README
تم إضافة توثيق شامل للمشروع يتضمن:
- متطلبات التشغيل
- خطوات التثبيت
- البنية المعمارية

## 🚀 الخطوات التالية

### 1. Merge هذا PR إلى main
```bash
# عند الدخول إلى PR، اضغط "Merge pull request"
```

### 2. تفعيل GitHub Pages (من الواجهة الرسومية)
- اذهب إلى **Settings** → **Pages**
- اختر **Deploy from a branch**
- اختر Branch: `gh-pages` (سيتم إنشاؤه تلقائياً بواسطة GitHub Actions)
- اضغط **Save**

### 3. Deployment التلقائي
بعد Merge الـ PR، عند كل push على `main`:
- ✅ سيتم تثبيت المكتبات
- ✅ سيتم بناء التطبيق
- ✅ سيتم نشر الملفات على GitHub Pages تلقائياً

## 📍 الوصول إلى الموقع

بعد اكتمال الـ Deployment الأول، سيكون الموقع متاحاً على:
```
https://emfalcon2025227.github.io/emfalcon/
```

## 🔧 استكشاف الأخطاء

### الموقع لا يزال فارغاً؟
1. تحقق من تشغيل GitHub Actions في **Actions** tab
2. ابحث عن Workflow باسم "Deploy to GitHub Pages"
3. إذا كان فيه خطأ، اضغط عليه لرؤية التفاصيل

### خطأ في الـ Build؟
```bash
# جرب البناء محلياً أولاً
npm install
npm run build
```

### مشكلة في .env؟
```bash
# تأكد من وجود .env.local بالمفتاح الصحيح
cp .env.example .env.local
# ثم أضف GEMINI_API_KEY الخاص بك
```

## 📚 الموارد الإضافية

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html#github-pages)

## ✨ ملاحظات مهمة

- الـ Deployment يتم تلقائياً عند كل push على `main`
- لا تحتاج لأي إجراء يدوي بعد الـ Setup الأولي
- جميع التحديثات ستنعكس على الموقع خلال دقائق

import { initializeApp } from "firebase-admin/app";
const app = initializeApp();
console.log("Project ID:", app.options.projectId);

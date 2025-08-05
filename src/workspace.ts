// workspace.ts
let projectPath: string;
let projectFiles: any;
let projectAbsolutePath: string;

export function setProjectPath(path: string) {
  projectPath = path;
}

export function getProjectPath() {
  return projectPath;
}

export function setProjectFiles(files: any) {
  projectFiles = files;
}

export function getProjectFiles() {
  return projectFiles;
}


export function setProjectAbsolutePath(path: string) {
  projectAbsolutePath = path;
}

export function getProjectAbsolutePath() {
  return projectAbsolutePath;
}

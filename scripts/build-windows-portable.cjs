const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const PELibrary = require('pe-library');
const ResEdit = require('resedit');
const sevenZip = require('7zip-bin').path7za;

const root = path.resolve(__dirname, '..');
const packageData = require(path.join(root, 'package.json'));
const releaseDirectory = path.join(root, 'release');
const workDirectory = path.join(releaseDirectory, '.portable-build');
const appDirectory = path.join(workDirectory, 'app');
const edgeAppDirectory = path.join(workDirectory, 'edge-app');
const archivePath = path.join(workDirectory, 'app.7z');
const outputName = `Numa-Calculadora-Windows-${packageData.version}.exe`;
const outputPath = path.join(releaseDirectory, outputName);
const zipName = `Numa-Calculadora-Windows-${packageData.version}.zip`;
const zipPath = path.join(releaseDirectory, zipName);
const sourceRuntime = path.join(root, 'node_modules', '@firesoon', 'electron-prebuilt', 'dist');
const sfxSource = path.join(root, 'build-tools', '7zsd_All_x64.sfx');
const iconPath = path.join(root, 'assets', 'icon.ico');

function log(message) {
  console.log(`[Numa] ${message}`);
}

function patchWindowsResources(source, destination) {
  try {
    const executable = PELibrary.NtExecutable.from(fs.readFileSync(source), { ignoreCert: true });
    const resources = PELibrary.NtExecutableResource.from(executable);
    const iconGroups = ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries);
    const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath));

    if (iconGroups.length > 0) {
      const group = iconGroups[0];
      ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
        resources.entries,
        group.id,
        group.lang,
        iconFile.icons.map((item) => item.data)
      );
    }

    const versionInfoList = ResEdit.Resource.VersionInfo.fromEntries(resources.entries);
    if (versionInfoList.length > 0) {
      const versionInfo = versionInfoList[0];
      versionInfo.setFileVersion(1, 0, 0, 0, 1033);
      versionInfo.setProductVersion(1, 0, 0, 0, 1033);
      versionInfo.setStringValues(
        { lang: 1033, codepage: 1200 },
        {
          FileDescription: 'Numa Calculadora',
          ProductName: 'Numa Calculadora',
          CompanyName: 'Numa',
          OriginalFilename: 'Numa Calculadora.exe',
          InternalName: 'Numa Calculadora'
        }
      );
      versionInfo.outputToResourceEntries(resources.entries);
    }

    resources.outputResource(executable);
    fs.writeFileSync(destination, Buffer.from(executable.generate()));
  } catch (error) {
    fs.copyFileSync(source, destination);
    console.warn(`[Numa] No se pudieron personalizar todos los recursos: ${error.message}`);
  }
}

function copyApplicationFiles(destination) {
  const files = [
    'index.html',
    'styles.css',
    'classic-calculator.css',
    'history-inline.css',
    'legacy-desktop.css',
    'app.js',
    'electron-main.cjs'
  ];

  fs.mkdirSync(destination, { recursive: true });
  for (const file of files) {
    fs.copyFileSync(path.join(root, file), path.join(destination, file));
  }
  fs.mkdirSync(path.join(destination, 'assets'), { recursive: true });
  fs.copyFileSync(path.join(root, 'assets', 'icon.png'), path.join(destination, 'assets', 'icon.png'));
  fs.writeFileSync(
    path.join(destination, 'package.json'),
    JSON.stringify({
      name: 'numa-calculadora',
      productName: 'Numa Calculadora',
      version: packageData.version,
      main: 'electron-main.cjs'
    }, null, 2)
  );
}

function prepareEdgeApplication(destination) {
  const webAppDirectory = path.join(destination, 'app');
  copyApplicationFiles(webAppDirectory);

  const launcher = [
    '@echo off',
    'setlocal',
    'set "APP_FILE=%~dp0app\\index.html"',
    'set "APP_URL=%APP_FILE:\\=/%"',
    'set "EDGE=%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe"',
    'if not exist "%EDGE%" set "EDGE=%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe"',
    'if not exist "%EDGE%" set "EDGE=%LOCALAPPDATA%\\Microsoft\\Edge\\Application\\msedge.exe"',
    'if exist "%EDGE%" (',
    '  start "" "%EDGE%" --app="file:///%APP_URL%?desktop=1" --user-data-dir="%LOCALAPPDATA%\\NumaCalculadora" --window-size=1280,900',
    '  exit /b 0',
    ')',
    'start "" "%APP_FILE%"',
    'exit /b 0',
    ''
  ].join('\r\n');

  const instructions = [
    'NUMA CALCULADORA PARA WINDOWS',
    '================================',
    '',
    '1. No muevas los archivos por separado.',
    '2. Haz doble clic en ABRIR NUMA CALCULADORA.cmd.',
    '3. La calculadora se abrira como una aplicacion independiente usando Microsoft Edge.',
    '4. El historial se guarda automaticamente en tu equipo.',
    '',
    'Si Edge no esta disponible, el programa abrira la calculadora en tu navegador predeterminado.',
    ''
  ].join('\r\n');

  fs.writeFileSync(path.join(destination, 'ABRIR NUMA CALCULADORA.cmd'), launcher, 'utf8');
  fs.writeFileSync(path.join(destination, 'LEEME.txt'), instructions, 'utf8');
}

function runSevenZip(argumentsList, formatName, workingDirectory = appDirectory) {
  fs.chmodSync(sevenZip, 0o755);
  const result = spawnSync(
    sevenZip,
    argumentsList,
    { cwd: workingDirectory, encoding: 'utf8', stdio: 'pipe' }
  );
  if (result.status !== 0) {
    throw new Error(`${formatName} terminó con código ${result.status}: ${result.stderr || result.stdout}`);
  }
}

function build() {
  log('Preparando la aplicación de Windows...');
  fs.rmSync(workDirectory, { recursive: true, force: true });
  fs.mkdirSync(releaseDirectory, { recursive: true });
  fs.cpSync(sourceRuntime, appDirectory, { recursive: true });

  const sourceExecutable = path.join(appDirectory, 'Firesoon.exe');
  const appExecutable = path.join(appDirectory, 'Numa Calculadora.exe');
  patchWindowsResources(sourceExecutable, appExecutable);
  fs.rmSync(sourceExecutable, { force: true });
  fs.rmSync(path.join(appDirectory, 'resources', 'default_app.asar'), { force: true });
  copyApplicationFiles(path.join(appDirectory, 'resources', 'app'));

  log('Comprimiendo el programa portable...');
  runSevenZip(['a', '-t7z', archivePath, '.', '-mx=9', '-m0=lzma2', '-mmt=on'], '7-Zip');
  prepareEdgeApplication(edgeAppDirectory);
  fs.rmSync(zipPath, { force: true });
  runSevenZip(['a', '-tzip', zipPath, '.', '-mx=9', '-mmt=on'], 'ZIP', edgeAppDirectory);

  const customizedSfx = path.join(workDirectory, 'numa-sfx.exe');
  patchWindowsResources(sfxSource, customizedSfx);
  const sfxConfiguration = Buffer.from(
    ';!@Install@!UTF-8! \r\n' +
    'Title="Numa Calculadora" \r\n' +
    'InstallPath="extract" \r\n' +
    'GUIMode="1" \r\n' +
    'OverwriteMode="2" \r\n' +
    'ExtractTitle="Iniciando Numa Calculadora" \r\n' +
    'RunProgram="Numa Calculadora.exe" \r\n' +
    ';!@InstallEnd@! \r\n',
    'utf8'
  );

  fs.writeFileSync(outputPath, Buffer.concat([
    fs.readFileSync(customizedSfx),
    sfxConfiguration,
    fs.readFileSync(archivePath)
  ]));

  const checksum = crypto.createHash('sha256').update(fs.readFileSync(outputPath)).digest('hex');
  const zipChecksum = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
  fs.writeFileSync(`${outputPath}.sha256.txt`, `${checksum}  ${outputName}\n`);
  fs.writeFileSync(`${zipPath}.sha256.txt`, `${zipChecksum}  ${zipName}\n`);
  fs.rmSync(workDirectory, { recursive: true, force: true });

  const megabytes = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
  const zipMegabytes = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
  log(`Listo: release/${outputName} (${megabytes} MB)`);
  log(`Respaldo: release/${zipName} (${zipMegabytes} MB)`);
}

build();

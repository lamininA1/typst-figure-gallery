import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// 데이터 인터페이스
interface FigureData {
	imagePath: string;
	caption: string;
	line: number;
	sourceFile: string;
	sourceFileUri: vscode.Uri;
	filePath: string; // 전체 경로 (전송용)
	figureNumber: number;
	label: string; // Label ID (예: <fig:experiment>)
}

export function activate(context: vscode.ExtensionContext) {
	let currentPanel: vscode.WebviewPanel | undefined = undefined;

	// 1. 명령어 등록
	let disposable = vscode.commands.registerCommand('typst-figure-gallery.openGallery', () => {
		const columnToShowIn = vscode.window.activeTextEditor
			? vscode.ViewColumn.Beside
			: undefined;

		if (currentPanel) {
			currentPanel.reveal(columnToShowIn);
		} else {
			currentPanel = vscode.window.createWebviewPanel(
				'typstGallery',
				'Typst Gallery',
				columnToShowIn || vscode.ViewColumn.One,
				{
					enableScripts: true,
					localResourceRoots: [vscode.Uri.file(path.join(vscode.workspace.rootPath || '', '/'))] 
				}
			);

			// 초기 HTML 세팅 (한 번만 실행됨)
			currentPanel.webview.html = getWebviewBaseContent(currentPanel.webview);

			// Webview -> Extension 메시지 수신
			currentPanel.webview.onDidReceiveMessage(
				async (message) => {
					if (message.command === 'openFile') {
						const uri = vscode.Uri.file(message.filePath);
						const line = message.line - 1;
						try {
							const doc = await vscode.workspace.openTextDocument(uri);
							const editor = await vscode.window.showTextDocument(doc, {
								selection: new vscode.Range(line, 0, line, 0),
								preview: false,
								viewColumn: vscode.ViewColumn.One 
							});
							editor.revealRange(new vscode.Range(line, 0, line, 0), vscode.TextEditorRevealType.InCenter);
						} catch (error) {
							vscode.window.showErrorMessage(`Cannot open file: ${message.filePath}`);
						}
					}
				},
				null,
				context.subscriptions
			);

			currentPanel.onDidDispose(() => {
				currentPanel = undefined;
			}, null, context.subscriptions);
		}

		// 패널 열릴 때 첫 데이터 전송
		updateWebviewData(currentPanel);
	});

	// 2. 실시간 업데이트 로직 (Debounce 적용)
	let updateTimer: NodeJS.Timeout | undefined = undefined;
	
	const triggerUpdate = () => {
		if (!currentPanel) return;
		if (updateTimer) clearTimeout(updateTimer);
		
		// 300ms 딜레이 (너무 빠르면 파싱 부하가 생김)
		updateTimer = setTimeout(() => {
			if (currentPanel) {
				updateWebviewData(currentPanel);
			}
		}, 300);
	};

	// 파일 내용 변경 시 (저장 안 해도 발동!)
	vscode.workspace.onDidChangeTextDocument((event) => {
		if (event.document.languageId === 'typst' && currentPanel) {
			triggerUpdate();
		}
	}, null, context.subscriptions);

	// 탭 전환 시 즉시 업데이트
	vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (editor && editor.document.languageId === 'typst' && currentPanel) {
			triggerUpdate();
		}
	}, null, context.subscriptions);

	context.subscriptions.push(disposable);
}

// ---------------------------------------------------------
// [핵심 1] 데이터만 추출해서 JSON으로 Webview에 쏘는 함수
// ---------------------------------------------------------
function updateWebviewData(panel: vscode.WebviewPanel) {
	const mainUri = findMainTypstFile();
	if (!mainUri) {
		// 데이터 없음을 알림
		panel.webview.postMessage({ command: 'updateFigures', data: [] });
		return;
	}
	
	const figures = extractFiguresFromAllFiles(mainUri);
	
	// 번호 매기기 & 전송용 데이터 가공
	const payload = figures.map((fig, index) => {
		// 이미지 경로를 Webview용 URL로 변환
		const sourceFolderPath = vscode.Uri.joinPath(fig.sourceFileUri, '..');
		const imagePathOnDisk = vscode.Uri.joinPath(sourceFolderPath, fig.imagePath);
		const imageUrl = panel.webview.asWebviewUri(imagePathOnDisk).toString();

		// 디버깅: 첫 번째 figure의 label 확인
		if (index === 0) {
			console.log(`[DEBUG updateWebviewData] fig.label: "${fig.label}"`);
			console.log(`[DEBUG updateWebviewData] fig keys:`, Object.keys(fig));
		}

		return {
			imagePath: fig.imagePath,
			caption: fig.caption,
			line: fig.line,
			sourceFile: fig.sourceFile,
			filePath: fig.sourceFileUri.fsPath,
			figureNumber: index + 1,
			imageUrl: imageUrl,
			label: fig.label || "" // 명시적으로 label 포함
		};
	});

	// Webview로 메시지 전송 (HTML 리로드 X)
	panel.webview.postMessage({ command: 'updateFigures', data: payload });
}

// ---------------------------------------------------------
// [핵심 2] 파일 읽기 도우미 (Disk vs Memory)
// ---------------------------------------------------------
function getFileContent(filePath: string): string {
	// 1. 현재 VS Code에 열려있는 탭(문서) 중에 해당 파일이 있는지 찾음
	const openDoc = vscode.workspace.textDocuments.find(doc => doc.fileName === filePath);
	
	// 2. 열려있다면 그 문서의 텍스트(수정 중인 내용 포함)를 반환 (Memory)
	if (openDoc) {
		return openDoc.getText();
	}
	
	// 3. 안 열려있다면 디스크에서 읽음 (Disk)
	if (fs.existsSync(filePath)) {
		return fs.readFileSync(filePath, 'utf-8');
	}
	
	return "";
}

// ---------------------------------------------------------
// 재귀적 파일 탐색 (getFileContent 사용하도록 수정)
// ---------------------------------------------------------
function extractFiguresFromAllFiles(mainUri: vscode.Uri): FigureData[] {
	const allFigures: FigureData[] = [];
	const processedFiles = new Set<string>();
	
	function processFile(fileUri: vscode.Uri) {
		const filePath = fileUri.fsPath;
		if (processedFiles.has(filePath)) return;
		
		// 파일 존재 여부는 fs로 체크하되, 내용은 getFileContent로 가져옴
		if (!fs.existsSync(filePath) && !vscode.workspace.textDocuments.find(d => d.fileName === filePath)) {
			return; 
		}
		
		processedFiles.add(filePath);
		
		try {
			// [중요] fs.readFileSync 대신 getFileContent 사용
			const text = getFileContent(filePath);
			
			const figures = extractFigures(text, fileUri);
			allFigures.push(...figures);
			
			const includeRegex = /#(?:include|import)\s+"([^"]+)"/g;
			let match;
			while ((match = includeRegex.exec(text)) !== null) {
				let includePath = match[1];
				const fileDir = path.dirname(filePath);
				if (!includePath.endsWith('.typ')) includePath += '.typ';
				const absolutePath = path.resolve(fileDir, includePath);
				processFile(vscode.Uri.file(absolutePath));
			}
		} catch (error) {
			console.error(`Error processing ${filePath}`, error);
		}
	}
	processFile(mainUri);
	return allFigures;
}

// ---------------------------------------------------------
// 메인 Typst 파일 찾기: 현재 파일 위치 기준으로 상위 디렉토리 탐색
// ---------------------------------------------------------
function findMainTypstFile(): vscode.Uri | null {
	const editor = vscode.window.activeTextEditor;
	if (!editor || editor.document.languageId !== 'typst') return null;

	const currentFileUri = editor.document.uri;
	const currentFilePath = currentFileUri.fsPath;
	let currentDir = path.dirname(currentFilePath);
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) return null;
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	while (currentDir !== workspaceRoot && currentDir !== path.dirname(currentDir)) {
		try {
			const files = fs.readdirSync(currentDir);
			const typFiles = files.filter(f => f.endsWith('.typ'));

			for (const typFile of typFiles) {
				const filePath = path.join(currentDir, typFile);
				try {
					// 여기도 getFileContent 사용
					const content = getFileContent(filePath);
					if (/#(?:include|import)\s+"/.test(content)) {
						return vscode.Uri.file(filePath);
					}
				} catch { continue; }
			}
			currentDir = path.dirname(currentDir);
		} catch { currentDir = path.dirname(currentDir); }
	}
	return currentFileUri; // 못 찾으면 현재 파일
}

// ---------------------------------------------------------
// 주석 처리 여부 확인
// ---------------------------------------------------------
function isCommentedOut(text: string, position: number): boolean {
	const beforeText = text.substring(0, position);
	const lineStart = beforeText.lastIndexOf('\n') + 1;
	const lineContent = beforeText.substring(lineStart);
	if (lineContent.includes('//')) {
		const commentIndex = lineContent.indexOf('//');
		const figureKeywordIndex = lineContent.indexOf('figure');
		if (commentIndex !== -1 && commentIndex < figureKeywordIndex) return true;
	}
	let searchPos = 0;
	while (true) {
		const blockCommentStart = beforeText.indexOf('/*', searchPos);
		if (blockCommentStart === -1) break;
		const blockCommentEnd = beforeText.indexOf('*/', blockCommentStart);
		if (blockCommentEnd === -1 || blockCommentEnd > position) return true;
		searchPos = blockCommentEnd + 2;
	}
	return false;
}

// ---------------------------------------------------------
// 파싱 로직: 괄호 개수를 세어서 figure() 전체 범위를 정확히 추출
// ---------------------------------------------------------
function extractFigures(text: string, docUri: vscode.Uri): FigureData[] {
	const figures: FigureData[] = [];
	const fileDir = path.dirname(docUri.fsPath);
	const fileName = path.basename(docUri.fsPath);
	const figureKeyword = "figure";
	let regex = /figure\s*\(/g;
	let match;

	while ((match = regex.exec(text)) !== null) {
		const figureStartIdx = match.index;
		if (isCommentedOut(text, figureStartIdx)) continue;
		
		const startIdx = match.index + match[0].length;
		let openCount = 1;
		let endIdx = startIdx;
		let contentInside = "";

		for (let i = startIdx; i < text.length; i++) {
			if (text[i] === '(') openCount++;
			else if (text[i] === ')') openCount--;
			if (openCount === 0) {
				endIdx = i;
				contentInside = text.substring(startIdx, endIdx);
				break;
			}
		}
		if (openCount !== 0) continue;

		// Label 추출: figure() 블록 닫는 괄호 뒤를 확인
		let labelText = "";
		
		// 닫는 괄호 뒤 200자 정도만 확인 (너무 길게 볼 필요 없음)
		const afterClosing = text.substring(endIdx + 1, Math.min(text.length, endIdx + 200));
		
		// 수정 핵심: '#' 기호가 없어도 <라벨>을 찾도록 정규식 변경
		// ^\s* : 시작 부분 공백/줄바꿈 허용
		// #? : 혹시 모를 # 문자 처리 (선택적)
		// <([^>]+)> : <라벨내용> 캡처
		const labelRegex = /^\s*#?\s*<([^>]+)>/; 
		
		const labelMatch = labelRegex.exec(afterClosing);
		if (labelMatch) {
			labelText = `<${labelMatch[1]}>`;
		}

		const imageRegex = /image\s*\(\s*"([^"]+)"/;
		const imgMatch = imageRegex.exec(contentInside);
		if (!imgMatch) continue;

		const relativePath = imgMatch[1];
		const absolutePath = path.resolve(fileDir, relativePath);
		if (!fs.existsSync(absolutePath)) continue;

		let captionText = "No Caption";
		const captionBracketRegex = /caption:\s*\[(.*?)\]/s;
		const capMatch = captionBracketRegex.exec(contentInside);
		if (capMatch) {
			captionText = capMatch[1].trim();
		} else {
			const captionStringRegex = /caption:\s*"([^"]+)"/;
			const capStrMatch = captionStringRegex.exec(contentInside);
			if (capStrMatch) captionText = capStrMatch[1].trim();
		}

		const line = text.substring(0, match.index).split('\n').length;
		figures.push({
			imagePath: relativePath,
			caption: captionText,
			line: line,
			sourceFile: fileName,
			sourceFileUri: docUri,
			filePath: docUri.fsPath,
			figureNumber: 0,
			label: labelText
		});
	}
	return figures;
}

// ---------------------------------------------------------
// [핵심 3] HTML 껍데기만 제공하고, 내용은 JS로 채움
// ---------------------------------------------------------
function getWebviewBaseContent(webview: vscode.Webview): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Typst Figure Gallery</title>
    <style>
        body { background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); padding: 20px; margin: 0; }
        h1 { font-size: 1.2rem; margin-bottom: 20px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; }
        .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
        .card { background-color: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-widget-border); border-radius: 6px; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; display: flex; flex-direction: column; cursor: pointer; }
        .card:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.2); border-color: var(--vscode-focusBorder); }
        .image-container { height: 150px; background-color: var(--vscode-editor-inactiveSelectionBackground); display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .image-container img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .caption { padding: 10px; font-size: 0.9em; }
        .figure-number { display: inline-block; font-size: 0.9em; font-weight: 600; color: var(--vscode-textLink-foreground); margin-bottom: 4px; margin-right: 6px; }
        .label-id { display: inline-block; font-size: 0.85em; font-weight: 500; color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family); margin-bottom: 4px; }
        .label-in-caption { display: block; font-size: 0.85em; color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family); margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--vscode-panel-border); }
        .label-in-caption-label { font-weight: 600; margin-right: 4px; }
        .line-number { display: block; font-size: 0.75em; color: var(--vscode-descriptionForeground); margin-bottom: 4px; font-family: var(--vscode-editor-font-family); }
        .caption p { margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px); animation: fadeIn 0.2s; }
        .modal.active { display: flex; align-items: center; justify-content: center; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .modal-content { background-color: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border); border-radius: 8px; width: 95vw; height: 95vh; display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); animation: slideUp 0.3s; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .modal-header { flex-shrink: 0; padding: 16px 20px; border-bottom: 1px solid var(--vscode-panel-border); display: flex; justify-content: space-between; align-items: center; }
        .modal-title { font-size: 1rem; font-weight: 600; color: var(--vscode-editor-foreground); }
        .modal-info { font-size: 0.85em; color: var(--vscode-descriptionForeground); margin-top: 4px; }
        .modal-close { background: none; border: none; font-size: 24px; color: var(--vscode-icon-foreground); cursor: pointer; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
        .modal-close:hover { background-color: var(--vscode-toolbar-hoverBackground); }
        .modal-body { flex: 1; overflow: hidden; padding: 20px; display: flex; flex-direction: column; min-height: 0; }
        .modal-image-container { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; background-color: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px; padding: 20px; overflow: hidden; }
        .modal-image { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; border-radius: 4px; }
        .modal-caption { flex-shrink: 0; margin-top: 20px; padding: 16px; background-color: var(--vscode-editorWidget-background); border-radius: 6px; border: 1px solid var(--vscode-widget-border); width: 100%; max-height: 200px; overflow-y: auto; box-sizing: border-box; }
        .modal-caption-label { font-size: 0.85em; color: var(--vscode-descriptionForeground); margin-bottom: 8px; font-weight: 600; }
        .modal-caption-text { font-size: 1em; color: var(--vscode-editor-foreground); line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
        .modal-footer { flex-shrink: 0; padding: 12px 20px; border-top: 1px solid var(--vscode-panel-border); display: flex; justify-content: space-between; align-items: center; font-size: 0.85em; color: var(--vscode-descriptionForeground); }
        .modal-nav { display: flex; gap: 8px; }
        .modal-nav-button { background-color: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85em; }
        .modal-nav-button:hover { background-color: var(--vscode-button-secondaryHoverBackground); }
        .modal-nav-button:disabled { opacity: 0.5; cursor: not-allowed; }
    </style>
</head>
<body>
    <h1 id="header-title">Figure Gallery (Loading...)</h1>
    <div class="gallery" id="gallery-container"></div>

    <div id="modal" class="modal" onclick="closeModalOnBackdrop(event)">
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div>
                    <div class="modal-title" id="modal-title">Figure Preview</div>
                    <div class="modal-info" id="modal-info"></div>
                </div>
                <button class="modal-close" onclick="closeModal()" title="Close (ESC)">&times;</button>
            </div>
            <div class="modal-body">
                <div class="modal-image-container">
                    <img id="modal-image" class="modal-image" src="" alt="" />
                </div>
                <div class="modal-caption">
                    <div class="modal-caption-label">Caption:</div>
                    <div class="modal-caption-text" id="modal-caption"></div>
                    <div class="label-in-caption" id="modal-label" style="display: none;">
                        <span class="label-in-caption-label">Label:</span>
                        <span id="modal-label-value"></span>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <div id="modal-counter"></div>
                <div class="modal-nav">
                    <button class="modal-nav-button" id="edit-button" onclick="editFigure()" title="Edit File">✏️ Edit</button>
                    <button class="modal-nav-button" id="prev-button" onclick="navigateModal(-1)">← Previous</button>
                    <button class="modal-nav-button" id="next-button" onclick="navigateModal(1)">Next →</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let figuresData = [];
        let currentModalIndex = -1;

        // Extension에서 데이터가 오면 실행됨
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateFigures') {
                figuresData = message.data;
                
                // 디버깅: 받은 데이터 확인
                if (figuresData.length > 0) {
                    console.log('[DEBUG JS] First figure data:', JSON.stringify(figuresData[0], null, 2));
                    console.log('[DEBUG JS] First figure label:', figuresData[0].label);
                    console.log('[DEBUG JS] First figure has label?', 'label' in figuresData[0]);
                }
                
                renderGallery();
                
                // 모달이 열려있으면 내용만 갱신 (모달을 끄지 않음!)
                if (currentModalIndex !== -1) {
                    // 데이터가 줄어서 현재 인덱스가 사라졌으면 닫기
                    if (currentModalIndex >= figuresData.length) {
                        closeModal();
                    } else {
                        // 같은 인덱스의 데이터로 모달 화면 갱신
                        updateModalContent(currentModalIndex);
                    }
                }
            }
        });

        function renderGallery() {
            const container = document.getElementById('gallery-container');
            const header = document.getElementById('header-title');
            
            header.textContent = \`Figure Gallery (\${figuresData.length})\`;
            
            if (figuresData.length === 0) {
                container.innerHTML = '<p>No figures found in this file.</p>';
                return;
            }

            container.innerHTML = figuresData.map((fig, index) => {
                const figNumber = fig.figureNumber;
                const figLabel = fig.label || '';
                const figSourceFile = fig.sourceFile || '';
                const figLine = fig.line || 0;
                const figCaption = fig.caption || '';
                const figImageUrl = fig.imageUrl || '';
                
                // [수정 핵심] <, > 문자를 HTML 엔티티(&lt;, &gt;)로 변환해야 화면에 보입니다.
                const escapeHtml = (str) => {
                    if (!str) return '';
                    return str
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                };

                const escapedCaption = escapeHtml(figCaption);
                const escapedLabel = escapeHtml(figLabel); // 이제 <figure.plot>이 &lt;figure.plot&gt;이 되어 보입니다.
                
                // label HTML 생성
                const labelHtml = escapedLabel ? ' <span class="label-id">' + escapedLabel + '</span>' : '';
                
                return \`
                    <div class="card" onclick="openModal(\${index})">
                        <div class="image-container">
                            <img src="\${figImageUrl}" alt="\${escapedCaption}" />
                        </div>
                        <div class="caption">
                            <span class="figure-number">Figure \${figNumber}\${labelHtml}</span>
                            <span class="line-number">\${figSourceFile}:\${figLine}</span>
                            <p>\${escapedCaption}</p>
                        </div>
                    </div>
                \`;
            }).join('');
        }

        function openModal(index) {
            currentModalIndex = index;
            updateModalContent(index);
            document.getElementById('modal').classList.add('active');
        }

        function updateModalContent(index) {
            const fig = figuresData[index];
            if (!fig) return;

            document.getElementById('modal-image').src = fig.imageUrl;
            // 모달 제목에 label 표시 (textContent 사용하므로 이스케이프 불필요)
            const titleText = fig.label ? 'Figure ' + fig.figureNumber + ' ' + fig.label : 'Figure ' + fig.figureNumber;
            document.getElementById('modal-title').textContent = titleText;
            document.getElementById('modal-caption').textContent = fig.caption || 'No Caption';
            
            // Caption 아래에 label 표시
            const labelElement = document.getElementById('modal-label');
            const labelValueElement = document.getElementById('modal-label-value');
            if (fig.label) {
                labelElement.style.display = 'block';
                labelValueElement.textContent = fig.label; // textContent 사용하므로 이스케이프 불필요
            } else {
                labelElement.style.display = 'none';
            }
            
            const infoText = fig.sourceFile + ':' + fig.line + ' | ' + fig.imagePath;
            document.getElementById('modal-info').textContent = infoText;
            document.getElementById('modal-counter').textContent = \`\${index + 1} / \${figuresData.length}\`;
            updateNavButtons();
        }

        function closeModal() {
            document.getElementById('modal').classList.remove('active');
            currentModalIndex = -1;
        }
        
        function closeModalOnBackdrop(event) {
            if (event.target.id === 'modal') closeModal();
        }

        function navigateModal(direction) {
            const newIndex = currentModalIndex + direction;
            if (newIndex >= 0 && newIndex < figuresData.length) {
                currentModalIndex = newIndex;
                updateModalContent(newIndex);
            }
        }

        function editFigure() {
            if (currentModalIndex === -1) return;
            const fig = figuresData[currentModalIndex];
            vscode.postMessage({
                command: 'openFile',
                filePath: fig.filePath,
                line: fig.line
            });
        }

        function updateNavButtons() {
            document.getElementById('prev-button').disabled = currentModalIndex <= 0;
            document.getElementById('next-button').disabled = currentModalIndex >= figuresData.length - 1;
        }

        document.addEventListener('keydown', (e) => {
            const modal = document.getElementById('modal');
            if (!modal.classList.contains('active')) return;
            if (e.key === 'Escape') closeModal();
            else if (e.key === 'ArrowLeft') navigateModal(-1);
            else if (e.key === 'ArrowRight') navigateModal(1);
            else if (e.key === 'e' || e.key === 'E') editFigure();
        });
    </script>
</body>
</html>`;
}

export function deactivate() {}

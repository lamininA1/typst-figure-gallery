# Typst Figure Gallery

VS Code 확장 프로그램으로, Typst 문서의 모든 `figure()` 블록을 한눈에 볼 수 있는 갤러리를 제공합니다. 논문이나 문서 작성 시 이미지와 캡션을 쉽게 확인하고 관리할 수 있습니다.

## ✨ 주요 기능

- 📸 **자동 Figure 탐지**: Typst 파일에서 `figure()` 블록을 자동으로 찾아 갤러리로 표시
- 🔄 **실시간 업데이트**: 파일을 저장하지 않아도 수정 내용이 실시간으로 반영됩니다
- 📁 **재귀적 파일 파싱**: `#include` 또는 `#import`로 참조된 모든 파일의 figure를 자동으로 수집
- 🔍 **확대 보기**: 카드를 클릭하면 모달에서 이미지를 크게 확인할 수 있습니다
- ✏️ **빠른 편집**: 모달에서 "수정" 버튼을 클릭하면 해당 figure가 선언된 파일로 바로 이동
- 🏷️ **Figure 번호**: 각 figure에 순차적으로 번호가 할당되어 관리가 쉽습니다
- 💬 **캡션 표시**: 각 figure의 캡션을 확인할 수 있습니다
- 🚫 **주석 필터링**: 주석 처리된 figure는 자동으로 제외됩니다

## 📦 설치

### VS Code Marketplace에서 설치

1. VS Code를 엽니다
2. 확장 프로그램 탭(Ctrl+Shift+X)으로 이동
3. "Typst Figure Gallery"를 검색
4. 설치 버튼 클릭

### 수동 설치

```bash
git clone https://github.com/your-username/typst-figure-gallery.git
cd typst-figure-gallery
npm install
npm run compile
```

그 다음 VS Code에서 `Ctrl+Shift+P` → "Extensions: Install from VSIX..." → `.vsix` 파일 선택

## 🚀 사용 방법

### 갤러리 열기

1. Typst 파일을 엽니다
2. `Ctrl+Shift+P` (또는 `F1`)를 눌러 명령 팔레트를 엽니다
3. "Typst: Open Figure Gallery"를 입력하고 실행합니다

또는 키보드 단축키를 설정할 수 있습니다:
- `File` → `Preferences` → `Keyboard Shortcuts`
- "Typst: Open Figure Gallery" 검색 후 원하는 단축키 설정

### 갤러리 사용

- **카드 클릭**: figure를 클릭하면 모달에서 확대된 이미지와 상세 정보를 볼 수 있습니다
- **키보드 네비게이션** (모달이 열려있을 때):
  - `←` / `→`: 이전/다음 figure로 이동
  - `ESC`: 모달 닫기
  - `E`: 파일에서 수정 (해당 figure 선언 위치로 이동)
- **수정 버튼**: 모달 하단의 "✏️ Edit" 버튼을 클릭하면 해당 figure가 선언된 파일로 이동합니다

## 📝 Typst 파일 예시

```typst
// main.typ
#include "sections/introduction.typ"
#include "sections/methods.typ"

// sections/introduction.typ
#figure(
  image("figures/experiment.png"),
  caption: [실험 결과 그래프]
)

#figure(
  image("figures/diagram.png"),
  caption: [시스템 구조도]
)

// sections/methods.typ
#figure(
  image("figures/algorithm.png"),
  caption: [알고리즘 흐름도]
)
```

위와 같은 구조에서 `main.typ`을 열고 갤러리를 실행하면, 모든 include된 파일의 figure들이 한 번에 표시됩니다.

## 🎯 작동 방식

1. **메인 파일 탐지**: 현재 열려있는 Typst 파일의 위치를 기준으로 상위 디렉토리를 탐색하여 `#include` 또는 `#import`를 사용하는 메인 파일을 찾습니다
2. **재귀적 파싱**: 메인 파일과 모든 include된 파일을 재귀적으로 탐색하여 `figure()` 블록을 추출합니다
3. **실시간 업데이트**: 파일 내용이 변경되면 300ms 후 자동으로 갤러리를 업데이트합니다 (저장 불필요)
4. **메모리 기반 읽기**: 열려있는 파일은 메모리에서 직접 읽어 저장하지 않아도 변경사항이 반영됩니다

## 🔧 요구사항

- VS Code 1.90.0 이상
- Typst 파일 (`.typ` 확장자)

## 📋 지원되는 Figure 형식

```typst
// 기본 형식
#figure(
  image("path/to/image.png"),
  caption: [캡션 텍스트]
)

// 문자열 캡션
#figure(
  image("path/to/image.png"),
  caption: "캡션 텍스트"
)

// 캡션 없음
#figure(
  image("path/to/image.png")
)
```

## 🚫 제외되는 항목

- 주석 처리된 figure:
  ```typst
  // #figure(image("test.png"), caption: [테스트])
  
  /*
  #figure(image("test.png"), caption: [테스트])
  */
  ```

## 🐛 문제 해결

### 갤러리에 figure가 표시되지 않아요

1. 파일이 올바른 경로에 있는지 확인하세요
2. `#figure()` 블록의 문법이 올바른지 확인하세요
3. 이미지 파일 경로가 올바른지 확인하세요
4. 주석 처리되어 있지 않은지 확인하세요

### 실시간 업데이트가 안 돼요

- 파일이 저장되지 않았더라도 열려있으면 자동으로 반영됩니다
- 갤러리 패널을 닫았다가 다시 열어보세요

## 🤝 기여하기

버그 리포트, 기능 제안, Pull Request를 환영합니다!

1. 이 저장소를 Fork합니다
2. 새 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'Add some amazing feature'`)
4. 브랜치에 Push합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🙏 감사의 말

Typst 커뮤니티와 모든 기여자분들께 감사드립니다.

---

**Made with ❤️ for Typst users**


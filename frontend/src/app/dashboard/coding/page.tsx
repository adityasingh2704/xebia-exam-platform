'use client';

import { useState, useCallback, useRef } from 'react';
import { clsx } from 'clsx';
import { codeExecutionApi } from '@/lib/api';

// Popular languages available in Judge0 CE
const LANGUAGES = [
  { id: 71, name: 'Python (3.8.1)', short: 'Python', ext: 'py', icon: 'terminal' },
  { id: 62, name: 'Java (OpenJDK 13.0.1)', short: 'Java', ext: 'java', icon: 'coffee' },
  { id: 54, name: 'C++ (GCC 9.2.0)', short: 'C++', ext: 'cpp', icon: 'memory' },
  { id: 51, name: 'C# (Mono 6.6.0.161)', short: 'C#', ext: 'cs', icon: 'code' },
  { id: 63, name: 'JavaScript (Node.js 12.14.0)', short: 'JavaScript', ext: 'js', icon: 'javascript' },
  { id: 78, name: 'Kotlin (1.3.70)', short: 'Kotlin', ext: 'kt', icon: 'code' },
  { id: 72, name: 'Ruby (2.7.0)', short: 'Ruby', ext: 'rb', icon: 'diamond' },
  { id: 73, name: 'Rust (1.40.0)', short: 'Rust', ext: 'rs', icon: 'settings_bssid' },
  { id: 68, name: 'PHP (7.4.1)', short: 'PHP', ext: 'php', icon: 'php' },
  { id: 60, name: 'Go (1.13.5)', short: 'Go', ext: 'go', icon: 'alt_route' },
  { id: 74, name: 'TypeScript (3.7.4)', short: 'TypeScript', ext: 'ts', icon: 'data_object' },
  { id: 50, name: 'C (GCC 9.2.0)', short: 'C', ext: 'c', icon: 'memory' },
  { id: 83, name: 'Swift (5.2.3)', short: 'Swift', ext: 'swift', icon: 'bolt' },
  { id: 80, name: 'R (4.0.0)', short: 'R', ext: 'r', icon: 'functions' },
];

const DEFAULT_CODE: Record<number, string> = {
  71: `# Python 3 Solution\ndef solve():\n    n = int(input())\n    print(f"Hello, World! n={n}")\n\nsolve()\n`,
  62: `// Java Solution\nimport java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        System.out.println("Hello, World! n=" + n);\n    }\n}\n`,
  54: `// C++ (GCC 9.2.0) Solution\n#include <iostream>\nusing namespace std;\n\nint main() {\n    int n;\n    cin >> n;\n    cout << "Hello, World! n=" << n << endl;\n    return 0;\n}\n`,
  63: `// JavaScript (Node.js) Solution\nconst readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin });\n\nrl.on('line', (line) => {\n    const n = parseInt(line);\n    console.log(\`Hello, World! n=\${n}\`);\n    rl.close();\n});\n`,
  74: `// TypeScript Solution\nconst readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin });\n\nrl.on('line', (line: string) => {\n    const n: number = parseInt(line);\n    console.log(\`Hello, World! n=\${n}\`);\n    rl.close();\n});\n`,
  50: `// C (GCC 9.2.0) Solution\n#include <stdio.h>\n\nint main() {\n    int n;\n    scanf("%d", &n);\n    printf("Hello, World! n=%d\\n", n);\n    return 0;\n}\n`,
  60: `// Go Solution\npackage main\n\nimport "fmt"\n\nfunc main() {\n    var n int\n    fmt.Scan(&n)\n    fmt.Printf("Hello, World! n=%d\\n", n)\n}\n`,
};

// Judge0 status codes mapping
const STATUS_MAP: Record<number, { label: string; color: string; badgeBg: string }> = {
  1: { label: 'In Queue', color: 'text-slate-400', badgeBg: 'bg-slate-500/10 border-slate-500/30' },
  2: { label: 'Processing', color: 'text-amber-400', badgeBg: 'bg-amber-500/10 border-amber-500/30' },
  3: { label: 'Accepted', color: 'text-emerald-400', badgeBg: 'bg-emerald-500/10 border-emerald-500/30' },
  4: { label: 'Wrong Answer', color: 'text-rose-400', badgeBg: 'bg-rose-500/10 border-rose-500/30' },
  5: { label: 'Time Limit Exceeded', color: 'text-amber-400', badgeBg: 'bg-amber-500/10 border-amber-500/30' },
  6: { label: 'Compilation Error', color: 'text-rose-400', badgeBg: 'bg-rose-500/10 border-rose-500/30' },
  7: { label: 'Runtime Error (SIGSEGV)', color: 'text-rose-400', badgeBg: 'bg-rose-500/10 border-rose-500/30' },
  8: { label: 'Runtime Error (SIGXFSZ)', color: 'text-rose-400', badgeBg: 'bg-rose-500/10 border-rose-500/30' },
  9: { label: 'Runtime Error (SIGFPE)', color: 'text-rose-400', badgeBg: 'bg-rose-500/10 border-rose-500/30' },
  10: { label: 'Runtime Error (SIGABRT)', color: 'text-rose-400', badgeBg: 'bg-rose-500/10 border-rose-500/30' },
  11: { label: 'Runtime Error (NZEC)', color: 'text-rose-400', badgeBg: 'bg-rose-500/10 border-rose-500/30' },
  12: { label: 'Runtime Error (Other)', color: 'text-rose-400', badgeBg: 'bg-rose-500/10 border-rose-500/30' },
  13: { label: 'Internal Error', color: 'text-rose-400', badgeBg: 'bg-rose-500/10 border-rose-500/30' },
  14: { label: 'Exec Format Error', color: 'text-rose-400', badgeBg: 'bg-rose-500/10 border-rose-500/30' },
};

interface ExecutionResult {
  token?: string;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: { id: number; description: string };
  time: string | null;
  memory: number | null;
}

interface TestCaseResult {
  testCase: number;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string | null;
  status: string;
  time: string | null;
  memory: number | null;
  error: string | null;
}

export default function CodingPage() {
  const [selectedLanguage, setSelectedLanguage] = useState(71); // Python default
  const [code, setCode] = useState(DEFAULT_CODE[71] || '');
  const [stdinList, setStdinList] = useState<string[]>(['10']);
  const [activeTab, setActiveTab] = useState<'run' | 'testcases'>('run');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [fontSize, setFontSize] = useState<number>(14);
  const [copyNotice, setCopyNotice] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<{
    passed: number;
    total: number;
    results: TestCaseResult[];
  } | null>(null);

  const [testCases, setTestCases] = useState([
    { inputs: ['10'], expected_output: 'Hello, World! n=10' },
  ]);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const selectedLangObj = LANGUAGES.find((l) => l.id === selectedLanguage) || LANGUAGES[0];

  const handleLanguageChange = (langId: number) => {
    setSelectedLanguage(langId);
    if (DEFAULT_CODE[langId]) {
      setCode(DEFAULT_CODE[langId]);
    }
    setResult(null);
    setTestResults(null);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopyNotice(true);
    setTimeout(() => setCopyNotice(false), 2000);
  };

  const handleResetCode = () => {
    if (DEFAULT_CODE[selectedLanguage]) {
      setCode(DEFAULT_CODE[selectedLanguage]);
    }
    setResult(null);
  };

  const handleFormatCode = () => {
    const lines = code.split('\n');
    const formatted = lines.map(line => line.trimEnd()).join('\n');
    setCode(formatted);
  };

  const getExecutionHint = (res: ExecutionResult) => {
    const errorMsg = (res.stderr || res.compile_output || res.message || '').toLowerCase();

    if (stdinList.some(val => !val.trim())) {
      return "Hint: Input parameter box is empty. Enter STDIN input under 'Custom Input (STDIN)' so your code can process parameters.";
    }

    if (errorMsg.includes('eof') || errorMsg.includes('empty') || errorMsg.includes('out of range')) {
      return "Hint: Program tried reading STDIN input that was not supplied. Click '+ Add STDIN' to add inputs.";
    }

    if (errorMsg.includes('semicolon') || errorMsg.includes('expected \';\'')) {
      return "Hint: Syntax Error - Missing semicolon ';' at the end of a line.";
    }

    if (errorMsg.includes('indentation')) {
      return "Hint: Indentation Error - Ensure consistent indent spacing in Python functions/loops.";
    }

    if (res.status?.id === 12) {
      return "Hint: Runtime Error - Ensure input values match expected data types.";
    }

    return null;
  };

  const handleRunCode = useCallback(async () => {
    setIsRunning(true);
    setResult(null);
    setTestResults(null);
    setActiveTab('run');

    try {
      const response = await codeExecutionApi.submit({
        source_code: code,
        language_id: selectedLanguage,
        stdin: stdinList.filter(Boolean).join('\n'),
      });
      setResult(response.data.data);
    } catch (err: any) {
      setResult({
        stdout: null,
        stderr: err.response?.data?.message || err.message || 'Failed to connect to Judge0 execution sandbox',
        compile_output: null,
        message: 'Service Error',
        status: { id: 13, description: 'Internal Error' },
        time: null,
        memory: null,
      });
    } finally {
      setIsRunning(false);
    }
  }, [code, selectedLanguage, stdinList]);

  const handleRunTests = useCallback(async () => {
    setIsRunning(true);
    setResult(null);
    setTestResults(null);
    setActiveTab('testcases');

    try {
      const response = await codeExecutionApi.runTestCases({
        source_code: code,
        language_id: selectedLanguage,
        test_cases: testCases.map((tc) => ({
          input: tc.inputs.filter(Boolean).join('\n'),
          expectedOutput: tc.expected_output,
        })),
      });
      setTestResults(response.data.data);
    } catch (err: any) {
      setTestResults({
        passed: 0,
        total: testCases.length,
        results: testCases.map((tc, idx) => ({
          testCase: idx + 1,
          passed: false,
          input: tc.inputs.filter(Boolean).join('\n'),
          expectedOutput: tc.expected_output,
          actualOutput: null,
          status: 'Service Error',
          time: null,
          memory: null,
          error: err.response?.data?.message || err.message || 'Failed to connect to execution sandbox',
        })),
      });
    } finally {
      setIsRunning(false);
    }
  }, [code, selectedLanguage, testCases]);

  const addTestCase = () => {
    setTestCases((prev) => [...prev, { inputs: ['10'], expected_output: '' }]);
  };

  const removeTestCase = (idx: number) => {
    if (testCases.length > 1) {
      setTestCases((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const updateTestCase = (idx: number, field: 'expected_output', value: string) => {
    setTestCases((prev) =>
      prev.map((tc, i) => (i === idx ? { ...tc, [field]: value } : tc)),
    );
  };

  const updateTestCaseInput = (tcIdx: number, inputIdx: number, value: string) => {
    setTestCases((prev) =>
      prev.map((tc, i) => {
        if (i === tcIdx) {
          const newInputs = [...tc.inputs];
          newInputs[inputIdx] = value;
          return { ...tc, inputs: newInputs };
        }
        return tc;
      }),
    );
  };

  const removeInputFromTestCase = (tcIdx: number, inputIdx: number) => {
    setTestCases((prev) =>
      prev.map((tc, i) => {
        if (i === tcIdx) {
          return { ...tc, inputs: tc.inputs.filter((_, idx) => idx !== inputIdx) };
        }
        return tc;
      }),
    );
  };

  const statusInfo = result ? STATUS_MAP[result.status.id] || { label: result.status.description, color: 'text-slate-300', badgeBg: 'bg-slate-500/10 border-slate-500/30' } : null;
  const lineCount = code.split('\n').length;

  const handleScrollSync = () => {
    if (editorRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = editorRef.current.scrollTop;
    }
  };

  return (
    <div className="h-[calc(100vh-56px-32px)] flex flex-col gap-0 -m-6 bg-surface-page dark:bg-[#0E0518] text-text-primary dark:text-[#F3ECFB] font-sans overflow-hidden transition-colors duration-200">
      {/* ── Top IDE Header Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between px-5 py-2.5 bg-surface-card dark:bg-[#140724] border-b border-border dark:border-[#2D144A] shrink-0 gap-3 shadow-sm dark:shadow-md z-10 transition-colors duration-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-primary-bright flex items-center justify-center shadow-lg shadow-primary/25">
              <span className="material-symbols-outlined text-white text-lg">code</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-text-primary dark:text-white tracking-wide">Code Playground</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary-bright border border-primary/30 uppercase tracking-widest">
                  PRO IDE
                </span>
              </div>
            </div>
          </div>

          {/* Language Selector */}
          <div className="relative flex items-center">
            <select
              className="bg-surface-page dark:bg-[#1F0E36] hover:bg-surface-container dark:hover:bg-[#281347] text-text-primary dark:text-purple-100 border border-border dark:border-[#3E1C6D] rounded-xl text-xs font-semibold px-3 py-1.5 pr-8 transition-all outline-none cursor-pointer focus:border-primary shadow-inner"
              value={selectedLanguage}
              onChange={(e) => handleLanguageChange(Number(e.target.value))}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id} className="bg-surface-card dark:bg-[#180A2B] text-text-primary dark:text-purple-100 py-1">
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Quick Tools */}
          <div className="flex items-center gap-1 bg-surface-page dark:bg-[#1A0B2F] p-1 rounded-xl border border-border dark:border-[#331759]">
            <button
              onClick={handleFormatCode}
              title="Format Code"
              className="p-1.5 text-text-muted hover:text-text-primary dark:text-purple-300 dark:hover:text-white hover:bg-surface-container dark:hover:bg-primary/20 rounded-lg transition-all"
            >
              <span className="material-symbols-outlined text-base">auto_fix_high</span>
            </button>
            <button
              onClick={handleCopyCode}
              title="Copy Code"
              className="p-1.5 text-text-muted hover:text-text-primary dark:text-purple-300 dark:hover:text-white hover:bg-surface-container dark:hover:bg-primary/20 rounded-lg transition-all relative"
            >
              <span className="material-symbols-outlined text-base">content_copy</span>
              {copyNotice && (
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap animate-bounce">
                  Copied!
                </span>
              )}
            </button>
            <button
              onClick={handleResetCode}
              title="Reset Code Template"
              className="p-1.5 text-text-muted hover:text-text-primary dark:text-purple-300 dark:hover:text-white hover:bg-surface-container dark:hover:bg-primary/20 rounded-lg transition-all"
            >
              <span className="material-symbols-outlined text-base">restart_alt</span>
            </button>
            <div className="h-4 w-px bg-border dark:bg-[#331759] mx-1" />
            <select
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              title="Font Size"
              className="bg-transparent text-text-muted dark:text-purple-300 text-xs font-semibold px-1 py-0.5 outline-none cursor-pointer"
            >
              <option value={12} className="bg-surface-card dark:bg-[#180A2B] text-text-primary dark:text-white">12px</option>
              <option value={14} className="bg-surface-card dark:bg-[#180A2B] text-text-primary dark:text-white">14px</option>
              <option value={16} className="bg-surface-card dark:bg-[#180A2B] text-text-primary dark:text-white">16px</option>
            </select>
          </div>

          {/* Execution CTA Buttons */}
          <button
            onClick={handleRunCode}
            disabled={isRunning || !code.trim()}
            className="bg-gradient-to-r from-amber-500 to-cta hover:from-amber-600 hover:to-cta-hover text-white font-bold rounded-xl px-4 py-1.5 text-xs tracking-wider shadow-lg shadow-cta/20 hover:shadow-cta/40 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning && activeTab === 'run' ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">play_arrow</span>
                <span>Run Code</span>
              </>
            )}
          </button>

          <button
            onClick={handleRunTests}
            disabled={isRunning || !code.trim()}
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl px-4 py-1.5 text-xs tracking-wider shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning && activeTab === 'testcases' ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Testing...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">fact_check</span>
                <span>Run Tests</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Main Workspace Split: Code Editor (Left) & Console (Right) ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Code Editor Window */}
        <div className="flex-1 flex flex-col border-r border-border dark:border-[#2C144A] bg-surface-card dark:bg-[#12071F] transition-colors duration-200">
          {/* File Tab Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-surface-page dark:bg-[#170929] border-b border-border dark:border-[#2C144A] shrink-0 transition-colors duration-200">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-card dark:bg-[#240F3E] border border-border dark:border-primary/30 text-text-primary dark:text-white text-xs font-medium">
                <span className="material-symbols-outlined text-sm text-amber-500 dark:text-amber-400">description</span>
                <span>main.{selectedLangObj.ext}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse ml-1" />
              </div>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-text-muted dark:text-purple-300/70 font-mono">
              <span>{lineCount} lines</span>
              <span>{code.length} chars</span>
            </div>
          </div>

          {/* Editor Gutter + Code Canvas */}
          <div className="flex-1 flex overflow-hidden relative bg-[#F8F9FC] dark:bg-[#130721] transition-colors duration-200">
            {/* Gutter / Line Numbers */}
            <div
              ref={gutterRef}
              className="w-12 py-4 select-none font-mono text-xs text-right pr-3 text-slate-400 dark:text-[#624785] bg-[#EEF1F6] dark:bg-[#0E0519] border-r border-border dark:border-[#2A1346] overflow-hidden leading-relaxed font-semibold shrink-0 transition-colors duration-200"
              style={{ fontSize: `${fontSize}px` }}
            >
              {Array.from({ length: lineCount }).map((_, i) => (
                <div key={i} className="h-6 flex items-center justify-end">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code Textarea */}
            <textarea
              ref={editorRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onScroll={handleScrollSync}
              spellCheck={false}
              className="flex-1 p-4 font-mono leading-relaxed resize-none outline-none bg-transparent text-[#1E1E2E] dark:text-[#F2E8FF] caret-cta overflow-auto"
              style={{
                fontSize: `${fontSize}px`,
                tabSize: 4,
                lineHeight: '1.5rem',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const start = e.currentTarget.selectionStart;
                  const end = e.currentTarget.selectionEnd;
                  const newCode = code.substring(0, start) + '    ' + code.substring(end);
                  setCode(newCode);
                  setTimeout(() => {
                    if (editorRef.current) {
                      editorRef.current.selectionStart = editorRef.current.selectionEnd = start + 4;
                    }
                  }, 0);
                }
              }}
            />
          </div>

          {/* Editor Footer Status Bar */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-surface-page dark:bg-[#10051B] border-t border-border dark:border-[#2A1346] text-[10px] text-text-muted dark:text-purple-300/60 font-mono shrink-0 transition-colors duration-200">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                IDE Sandboxed Ready
              </span>
              <span>UTF-8</span>
              <span>Tab Size: 4</span>
            </div>
            <div className="flex items-center gap-3">
              <span>{selectedLangObj.name}</span>
            </div>
          </div>
        </div>

        {/* Right: Output / Test Cases Panel */}
        <div className="w-[450px] min-w-[380px] flex flex-col bg-surface-card dark:bg-[#160B26] border-l border-border dark:border-[#2B1446] transition-colors duration-200">
          {/* Panel Header Tabs */}
          <div className="flex items-center border-b border-border dark:border-[#2C144A] bg-surface-page dark:bg-[#140724] shrink-0 p-1 transition-colors duration-200">
            <button
              onClick={() => setActiveTab('run')}
              className={clsx(
                'flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2',
                activeTab === 'run'
                  ? 'bg-surface-card dark:bg-[#291347] text-text-primary dark:text-white shadow-sm border border-border dark:border-primary/40'
                  : 'text-text-muted dark:text-purple-300/60 hover:text-text-primary dark:hover:text-white hover:bg-surface-container dark:hover:bg-white/5',
              )}
            >
              <span className="material-symbols-outlined text-base text-amber-500 dark:text-amber-400">terminal</span>
              <span>Console STDOUT</span>
            </button>

            <button
              onClick={() => setActiveTab('testcases')}
              className={clsx(
                'flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2',
                activeTab === 'testcases'
                  ? 'bg-surface-card dark:bg-[#291347] text-text-primary dark:text-white shadow-sm border border-border dark:border-primary/40'
                  : 'text-text-muted dark:text-purple-300/60 hover:text-text-primary dark:hover:text-white hover:bg-surface-container dark:hover:bg-white/5',
              )}
            >
              <span className="material-symbols-outlined text-base text-emerald-500 dark:text-emerald-400">fact_check</span>
              <span>Test Suite</span>
              {testResults && (
                <span
                  className={clsx(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-bold border',
                    testResults.passed === testResults.total
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/30',
                  )}
                >
                  {testResults.passed}/{testResults.total}
                </span>
              )}
            </button>
          </div>

          {/* Panel Main Body */}
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {activeTab === 'run' ? (
              <div className="flex flex-col h-full space-y-4">
                {/* Custom STDIN Section */}
                <div className="p-3.5 rounded-2xl bg-surface-page dark:bg-[#1D0E33] border border-border dark:border-[#34185A] space-y-3 shrink-0 shadow-inner transition-colors duration-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-primary dark:text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-primary">keyboard</span>
                      Custom Input (STDIN)
                    </label>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {stdinList.map((val, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-[10px] text-text-muted dark:text-purple-400 font-mono w-4 text-right">{idx + 1}.</span>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => {
                            const newList = [...stdinList];
                            newList[idx] = e.target.value;
                            setStdinList(newList);
                          }}
                          placeholder="write your input here..."
                          className="w-full px-3 py-1.5 rounded-xl font-mono text-xs bg-surface-card dark:bg-[#130721] text-text-primary dark:text-purple-100 border border-border dark:border-[#3D1B6B] focus:border-primary outline-none placeholder:text-text-muted dark:placeholder:text-purple-400/50"
                        />
                        {stdinList.length > 1 && (
                          <button
                            onClick={() => {
                              const newList = stdinList.filter((_, i) => i !== idx);
                              setStdinList(newList);
                            }}
                            className="p-1 text-text-muted hover:text-rose-500 transition-colors"
                            title="Remove input"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setStdinList([...stdinList, ''])}
                    className="w-full py-1.5 px-3 text-xs font-semibold rounded-xl bg-surface-card dark:bg-[#281347] hover:bg-surface-container dark:hover:bg-[#341A5C] text-text-primary dark:text-purple-200 border border-border dark:border-[#431F75] transition-all flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Add STDIN Parameter
                  </button>
                </div>

                {/* Program Output (STDOUT) Terminal Box */}
                <div className="flex-1 flex flex-col bg-surface-page dark:bg-[#0B0414] border border-border dark:border-[#331854] rounded-2xl p-4 shadow-inner dark:shadow-2xl min-h-[220px] transition-colors duration-200">
                  {/* Terminal Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-border dark:border-[#271242] mb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                      </div>
                      <span className="text-[11px] font-mono font-bold text-text-primary dark:text-purple-300/80 ml-2">STDOUT Output</span>
                    </div>

                    {result && statusInfo && (
                      <div className="flex items-center gap-2">
                        <span className={clsx('px-2.5 py-0.5 rounded-full text-[11px] font-bold border', statusInfo.badgeBg, statusInfo.color)}>
                          {statusInfo.label}
                        </span>
                        {result.time && (
                          <span className="text-[10px] text-text-secondary dark:text-purple-300/70 font-mono px-2 py-0.5 rounded bg-surface-card dark:bg-[#170929] border border-border dark:border-[#311654]">
                            ⚡ {result.time}s
                          </span>
                        )}
                        {result.memory && (
                          <span className="text-[10px] text-text-secondary dark:text-purple-300/70 font-mono px-2 py-0.5 rounded bg-surface-card dark:bg-[#170929] border border-border dark:border-[#311654]">
                            💾 {(result.memory / 1024).toFixed(1)}MB
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Terminal Content */}
                  <div className="flex-1 overflow-auto min-h-0">
                    {isRunning && activeTab === 'run' ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                        <div className="relative flex h-10 w-10 items-center justify-center">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cta opacity-75" />
                          <span className="relative inline-flex rounded-full h-8 w-8 bg-cta items-center justify-center text-white font-bold text-xs">
                            <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                          </span>
                        </div>
                        <p className="text-xs font-mono text-slate-300 dark:text-purple-300 animate-pulse">
                          Compiling and executing code on isolated runtime...
                        </p>
                      </div>
                    ) : result ? (
                      <div className="space-y-3">
                        {/* Stdout Output */}
                        {result.stdout && (
                          <div>
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1 block">stdout</span>
                            <pre className="p-3 rounded-xl font-mono text-xs leading-relaxed whitespace-pre-wrap bg-[#111827] dark:bg-[#130721] text-emerald-400 dark:text-emerald-300 border border-emerald-500/20 shadow-inner overflow-auto max-h-56">
                              {result.stdout}
                            </pre>
                          </div>
                        )}

                        {/* Stderr Output */}
                        {result.stderr && (
                          <div>
                            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1 block">stderr</span>
                            <pre className="p-3 rounded-xl font-mono text-xs leading-relaxed whitespace-pre-wrap bg-[#1F1216] dark:bg-[#1C0816] text-rose-400 dark:text-rose-300 border border-rose-500/20 shadow-inner overflow-auto max-h-40">
                              {result.stderr}
                            </pre>
                          </div>
                        )}

                        {/* Compilation Error Output */}
                        {result.compile_output && (
                          <div>
                            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1 block">Compilation Error</span>
                            <pre className="p-3 rounded-xl font-mono text-xs leading-relaxed whitespace-pre-wrap bg-[#1F190D] dark:bg-[#1C1105] text-amber-400 dark:text-amber-300 border border-amber-500/20 shadow-inner overflow-auto max-h-40">
                              {result.compile_output}
                            </pre>
                          </div>
                        )}

                        {!result.stdout && !result.stderr && !result.compile_output && (
                          <div className="text-xs text-slate-400 dark:text-purple-300/50 italic py-6 text-center">
                            Program executed successfully with no STDOUT output.
                          </div>
                        )}

                        {/* AI Diagnostic Hint Assistant */}
                        {getExecutionHint(result) && (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-200 rounded-xl text-xs flex gap-2.5 items-start mt-3 shadow-lg">
                            <span className="material-symbols-outlined text-amber-500 dark:text-amber-400 text-lg shrink-0">lightbulb</span>
                            <div className="leading-relaxed">
                              {getExecutionHint(result)}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted dark:text-purple-300/40 space-y-2">
                        <span className="material-symbols-outlined text-4xl">play_circle</span>
                        <p className="text-xs">
                          Click <strong className="text-amber-500 dark:text-amber-400">Run Code</strong> to execute your code against STDIN parameters.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Test Cases Suite Tab */
              <div className="space-y-4">
                {/* Summary Banner */}
                {testResults && (
                  <div
                    className={clsx(
                      'p-3.5 rounded-2xl border flex items-center gap-3 shadow-lg',
                      testResults.passed === testResults.total
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300',
                    )}
                  >
                    <span className="material-symbols-outlined text-2xl shrink-0">
                      {testResults.passed === testResults.total ? 'check_circle' : 'cancel'}
                    </span>
                    <div>
                      <p className="text-sm font-bold">
                        {testResults.passed === testResults.total
                          ? '🎉 All Test Cases Passed Successfully!'
                          : `⚠️ ${testResults.passed} of ${testResults.total} Test Cases Passed`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Test Cases Accordion List */}
                {(testResults ? testResults.results : testCases.map((tc, i) => ({
                  testCase: i + 1,
                  input: tc.inputs.filter(Boolean).join('\n'),
                  inputs: tc.inputs,
                  expectedOutput: tc.expected_output,
                  actualOutput: null as string | null,
                  passed: null as boolean | null,
                  status: null as string | null,
                  time: null as string | null,
                  memory: null as number | null,
                  error: null as string | null,
                }))).map((tc, idx) => (
                  <div
                    key={idx}
                    className={clsx(
                      'border rounded-2xl overflow-hidden bg-surface-page dark:bg-[#180A2B] transition-all shadow-md',
                      testResults
                        ? tc.passed
                          ? 'border-emerald-500/40'
                          : 'border-rose-500/40'
                        : 'border-border dark:border-[#331757]',
                    )}
                  >
                    {/* Test Case Title Bar */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-surface-card dark:bg-[#140724] border-b border-border dark:border-[#2C1347]">
                      <div className="flex items-center gap-2">
                        {testResults && (
                          <span
                            className={clsx(
                              'material-symbols-outlined text-base',
                              tc.passed ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400',
                            )}
                          >
                            {tc.passed ? 'check_circle' : 'cancel'}
                          </span>
                        )}
                        <span className="text-xs font-bold text-text-primary dark:text-white">
                          Test Case #{tc.testCase}
                        </span>
                        {testResults && tc.time && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container dark:bg-[#251042] text-text-muted dark:text-purple-300">
                            ⚡ {tc.time}s
                          </span>
                        )}
                      </div>
                      {!testResults && testCases.length > 1 && (
                        <button
                          onClick={() => removeTestCase(idx)}
                          className="text-text-muted hover:text-rose-500 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      )}
                    </div>

                    {/* Test Case Inputs & Outputs */}
                    <div className="p-3.5 space-y-3 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-text-muted dark:text-purple-400 uppercase tracking-wider mb-1 block">Input</label>
                        {testResults ? (
                          <pre className="font-mono text-xs p-2.5 rounded-xl bg-surface-card dark:bg-[#0F051C] text-text-primary dark:text-purple-200 border border-border dark:border-[#2F144E]">{tc.input}</pre>
                        ) : (
                          <div className="space-y-2">
                            {testCases[idx].inputs.map((val, inputIdx) => (
                              <div key={inputIdx} className="flex items-center gap-2">
                                <span className="text-[10px] text-text-muted dark:text-purple-400 font-mono w-4 text-right">{inputIdx + 1}.</span>
                                <input
                                  type="text"
                                  value={val}
                                  onChange={(e) => updateTestCaseInput(idx, inputIdx, e.target.value)}
                                  placeholder="write your input here..."
                                  className="w-full px-3 py-1.5 rounded-xl font-mono text-xs bg-surface-card dark:bg-[#0F051C] text-text-primary dark:text-purple-100 border border-border dark:border-[#331757] focus:border-primary outline-none"
                                />
                                {testCases[idx].inputs.length > 1 && (
                                  <button
                                    onClick={() => removeInputFromTestCase(idx, inputIdx)}
                                    className="p-1 text-text-muted hover:text-rose-500 transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-text-muted dark:text-purple-400 uppercase tracking-wider mb-1 block">Expected Output</label>
                        {testResults ? (
                          <pre className="font-mono text-xs p-2.5 rounded-xl bg-surface-card dark:bg-[#0F051C] text-text-primary dark:text-purple-200 border border-border dark:border-[#2F144E]">{tc.expectedOutput}</pre>
                        ) : (
                          <textarea
                            className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-surface-card dark:bg-[#0F051C] text-text-primary dark:text-purple-100 border border-border dark:border-[#331757] focus:border-primary outline-none resize-y min-h-[55px]"
                            value={testCases[idx].expected_output}
                            rows={2}
                            onChange={(e) => updateTestCase(idx, 'expected_output', e.target.value)}
                            placeholder="Enter expected output"
                          />
                        )}
                      </div>

                      {testResults && tc.actualOutput !== null && (
                        <div>
                          <label className="text-[10px] font-bold text-text-muted dark:text-purple-400 uppercase tracking-wider mb-1 block">Actual Output</label>
                          <pre
                            className={clsx(
                              'font-mono text-xs p-2.5 rounded-xl border',
                              tc.passed
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30',
                            )}
                          >
                            {tc.actualOutput}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {!testResults && (
                  <button
                    onClick={addTestCase}
                    className="w-full py-2.5 rounded-2xl border-2 border-dashed border-border dark:border-[#3A1A63] hover:border-primary text-xs font-bold text-text-muted dark:text-purple-300 hover:text-text-primary dark:hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    Add Test Case
                  </button>
                )}

                {testResults && (
                  <button
                    onClick={() => setTestResults(null)}
                    className="w-full text-xs font-bold text-text-muted dark:text-purple-300 hover:text-primary text-center py-2 transition-colors"
                  >
                    ← Edit Test Cases
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

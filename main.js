// Initialize CodeMirror Editor
let editor = CodeMirror(document.getElementById('editor'), {
    mode: "python",
    theme: "default",
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
});
  
// Sample starter code
editor.setValue(`print("Hello, Robot!")`);
  
// Console functions
const consoleBody = document.getElementById('console-body');

function logToConsole(message, isError = false) {
    const line = document.createElement('div');
    line.textContent = message;
    if (isError) {
        line.style.color = 'red'; // make errors red
        line.style.fontWeight = 'bold';
    }
    consoleBody.appendChild(line);
    consoleBody.scrollTop = consoleBody.scrollHeight;
}

// Button listeners
document.getElementById('run-button').addEventListener('click', () => {
    const userCode = editor.getValue();
    executePythonCode(userCode);
});

document.getElementById('clear-console').addEventListener('click', () => {
    consoleBody.innerHTML = '';
});

// Panel resizing
const minLeftWidth = 300;
const minRightWidth = 300;
const panelDivider = document.getElementById('panel-divider');
let isDragging = false;
panelDivider.addEventListener('mousedown', function(e) {
    isDragging = true;
    document.body.style.cursor = 'ew-resize';
});
document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    let containerRect = document.getElementById('container').getBoundingClientRect();
    let leftWidth = e.clientX - containerRect.left;
    let rightWidth = containerRect.right - e.clientX;
    
    if (leftWidth < minLeftWidth) leftWidth = minLeftWidth;
    if (rightWidth < minRightWidth) leftWidth = containerRect.width - minRightWidth;
    
    document.getElementById('editor-section').style.width = leftWidth + 'px';
});
document.addEventListener('mouseup', function(e) {
    isDragging = false;
    document.body.style.cursor = '';
});

// IDE/Console resizing
const horizontalDivider = document.getElementById('horizontal-divider');
let isDraggingHorizontal = false;
horizontalDivider.addEventListener('mousedown', function(e) {
    isDraggingHorizontal = true;
    document.body.style.cursor = 'ns-resize';
});
document.addEventListener('mousemove', function(e) {
    if (!isDraggingHorizontal) return;

    const editorSection = document.getElementById('editor-section');
    const containerRect = editorSection.getBoundingClientRect();
    const totalHeight = containerRect.height;
    const dividerHeight = horizontalDivider.offsetHeight;

    let newEditorHeight = e.clientY - containerRect.top;
    let newConsoleHeight = totalHeight - newEditorHeight - dividerHeight;

    const minEditorHeight = 150;
    const minConsoleHeight = 200;

    // Apply constraints
    if (newEditorHeight < minEditorHeight) {
        newEditorHeight = minEditorHeight;
        newConsoleHeight = totalHeight - minEditorHeight - dividerHeight;
    }
    if (newConsoleHeight < minConsoleHeight) {
        newConsoleHeight = minConsoleHeight;
        newEditorHeight = totalHeight - minConsoleHeight - dividerHeight;
    }

    document.getElementById('editor').style.flex = `0 0 ${newEditorHeight}px`;
    document.getElementById('console').style.flex = `0 0 ${newConsoleHeight}px`;

    if (editor && typeof editor.refresh === 'function') {
        editor.refresh();
    }
});
document.addEventListener('mouseup', function(e) {
    isDraggingHorizontal = false;
    document.body.style.cursor = '';
});
  
// Run Python code via PyScript
let pyodideReadyPromise = loadPyodide();
async function executePythonCode(code) {
    const pyodide = await pyodideReadyPromise;

    // Capture stdout
    pyodide.setStdout({
        batched: (output) => {
            logToConsole(output);
        }
    });

    // Capture stderr
    pyodide.setStderr({
        batched: (error) => {
            // Make errors red
            logToConsole(error, true);
        }
    });

    try {
        await pyodide.runPythonAsync(code);
    } catch (err) {
        if (err.message) {
            // Use err.stack instead of err.message
            let lines = (err.stack || err.message).trim().split('\n');
    
            // Filter out Pyodide internal junk and URLs
            let usefulLines = lines.filter(line => 
                !line.includes("_pyodide") &&
                !line.includes("eval(self.code") &&
                !line.includes("eval_code_async") &&
                !line.includes("CodeRunner") &&
                !line.includes("self.ast = next") &&
                !line.includes("new_error") && // Exclude new_error part
                !line.includes("https://") // Exclude URLs
            );
    
            // Check if it's a SyntaxError style
            let syntaxErrorIndex = usefulLines.findIndex(line => line.includes('line'));
    
            if (syntaxErrorIndex !== -1 && usefulLines[syntaxErrorIndex + 3]) {
                // Syntax error format
                let fileLine = usefulLines[syntaxErrorIndex];
                let match = fileLine.match(/line (\d+)/);
                let lineNumber = match ? match[1] : "?";
                let codeLine = usefulLines[syntaxErrorIndex + 1];
                let pointerLine = usefulLines[syntaxErrorIndex + 2];
                let errorTypeLine = usefulLines[syntaxErrorIndex + 3];
    
                let cleanedError = `Line ${lineNumber}\n${codeLine}\n${pointerLine}\n${errorTypeLine}`;
                logToConsole(cleanedError, true);
            } else {
                // General runtime error, clean output
                let cleanedError = usefulLines.slice(-3).join('\n');
    
                // Remove "File <exec>" from the cleaned error
                cleanedError = cleanedError.replace(/File "<exec>",?/, "").trim();
    
                // Change 'line' to 'Line' for consistency
                cleanedError = cleanedError.replace(/line (\d+)/, (match, p1) => `Line ${p1}`);
    
                logToConsole(cleanedError, true);
            }
        } else {
            logToConsole('Unknown Error', true);
        }
    }    
}

// Expose JS function to Python
window.console_log = logToConsole;

const canvas = document.getElementById('simulator');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(canvas.clientWidth, canvas.clientHeight);

// Robot body
const robotBody = new THREE.Mesh(
    new THREE.BoxGeometry(2, 3, 1),
    new THREE.MeshPhongMaterial({ color: 0x00ff00 })
);
scene.add(robotBody);

// Robot head
const robotHead = new THREE.Mesh(
    new THREE.SphereGeometry(1),
    new THREE.MeshPhongMaterial({ color: 0x0000ff })
);
robotHead.position.y = 2.5;
robotBody.add(robotHead);

// Left Arm
const armGeometry = new THREE.CylinderGeometry(0.2, 0.2, 3);
const armMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
const leftArm = new THREE.Mesh(armGeometry, armMaterial);
leftArm.position.set(-1.5, 1, 0);
robotBody.add(leftArm);

// Right Arm
const rightArm = new THREE.Mesh(armGeometry, armMaterial);
rightArm.position.set(1.5, 1, 0);
robotBody.add(rightArm);

// Left Leg
const legGeometry = new THREE.CylinderGeometry(0.3, 0.3, 4);
const legMaterial = new THREE.MeshPhongMaterial({ color: 0x0000ff });
const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
leftLeg.position.set(-0.5, -3.5, 0);
robotBody.add(leftLeg);

// Right Leg
const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
rightLeg.position.set(0.5, -3.5, 0);
robotBody.add(rightLeg);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Camera
camera.position.set(5, 5, 10);
camera.lookAt(0, 0, 0);

// Animation
function animate() {
    requestAnimationFrame(animate);
    robotBody.rotation.y += 0.01;
    renderer.render(scene, camera);
}
animate();

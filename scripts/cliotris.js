(() => {
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false; 
    ctx.mozImageSmoothingEnabled = false; 
    ctx.webkitImageSmoothingEnabled = false; 
    ctx.msImageSmoothingEnabled = false; 
    const W = 10, H = 20, CELL = 24;
    canvas.width = W * CELL;
    canvas.height = H * CELL;
    const cols = W, rows = H;
    const scoreEl = document.getElementById('score');
    const restartBtn = document.getElementById('restart');
    const clioimage = document.getElementById('clio');
    const cliopinkimage = document.getElementById('cliopink');
    const COLORS = {
        I: '#00f0f0', J: '#0000f0', L:'#f0a000', O:'#f0f000', S:'#00f000', T:'#a000f0', Z:'#f00000',
        PINK: '#ff5fbf'
    };

    const SHAPES = {
        I: [[[0,1],[1,1],[2,1],[3,1]], [[2,0],[2,1],[2,2],[2,3]]],
        J: [[[0,0],[0,1],[1,1],[2,1]], [[1,0],[2,0],[1,1],[1,2]], [[0,1],[1,1],[2,1],[2,2]], [[1,0],[1,1],[0,2],[1,2]]],
        L: [[[2,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[1,2],[2,2]], [[0,1],[1,1],[2,1],[0,2]], [[0,0],[1,0],[1,1],[1,2]]],
        O: [[[1,0],[2,0],[1,1],[2,1]]],
        S: [[[1,0],[2,0],[0,1],[1,1]], [[1,0],[1,1],[2,1],[2,2]]],
        T: [[[1,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[2,1],[1,2]], [[1,0],[0,1],[1,1],[1,2]]],
        Z: [[[0,0],[1,0],[1,1],[2,1]], [[2,0],[1,1],[2,1],[1,2]]]
    };

    let grid, current, gameInterval, dropTime = 600, score = 0, running = true;

    function initGrid() {
        grid = Array.from({length:rows}, () => Array.from({length:cols}, () => null));
    }

    function randChoice(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

    function spawnPiece() {
        // 10% chance to spawn special pink 1x4 (vertical/horizontal)
        const isPink = Math.random() < 0.12;
        if (isPink) {
            // Use I-shape but color pink
            const orientation = Math.random() < 0.5 ? 0 : 1;
            const shapes = SHAPES.I;
            const shape = shapes[orientation];
            const piece = {
                shape: shape.map(s => s.slice()),
                rotIndex: orientation,
                rotations: shapes,
                x: 3,
                y: 0,
                type: 'PINK',
                color: COLORS.PINK,
                special: true
            };
            current = piece;
            return;
        }

        const types = ['I','J','L','O','S','T','Z'];
        const t = randChoice(types);
        const shapes = SHAPES[t];
        const piece = {
            rotations: shapes,
            rotIndex: 0,
            shape: shapes[0].map(s => s.slice()),
            x: 3,
            y: 0,
            type: t,
            color: COLORS[t],
            special: false
        };
        current = piece;
    }

    function collide(xOffset=0,yOffset=0,shape= current.shape) {
        for (let b of shape) {
            const x = current.x + b[0] + xOffset;
            const y = current.y + b[1] + yOffset;
            if (x < 0 || x >= cols || y >= rows) return true;
            if (y >= 0 && grid[y][x]) return true;
        }
        return false;
    }

    function lockPiece() {
        for (let b of current.shape) {
            const x = current.x + b[0];
            const y = current.y + b[1];
            if (y >= 0 && y < rows && x >=0 && x < cols) grid[y][x] = {color: current.color, type: current.type};
        }
        clearFullRows();
        spawnPiece();
        if (collide(0,0)) {
            // spawn collision -> game over, reset
            running = false;
            clearInterval(gameInterval);
            setTimeout(()=> { end(score); }, 10);
        }
    }
    function end(finalScore) {
        const dlg = document.getElementById('end');
        if (!dlg) return;
        const scoreSpan = dlg.querySelector('span') || null;
        if (scoreSpan) scoreSpan.textContent = String(finalScore);
        const btn = dlg.querySelector('button');
        if (btn) {
            btn.onclick = () => {
                try { dlg.close(); } catch (e) { dlg.removeAttribute('open'); }
                // restart the game when closing the dialog
                try { restart(); } catch (e) { /* ignore if restart not available */ }
            };
        }
        try {
            if (typeof dlg.showModal === 'function') dlg.showModal();
            else dlg.setAttribute('open', '');
        } catch (err) {
            // fallback for older browsers: make it visible
            dlg.setAttribute('open', '');
        }
    }
    function clearFullRows() {
        for (let y = rows -1; y >= 0; --y) {
            if (grid[y].every(c => c !== null)) {
                grid.splice(y,1);
                grid.unshift(Array.from({length:cols}, () => null));
                score += 100;
                scoreEl.textContent = score;
                y++; // recheck same index as rows shifted
            }
        }
    }

    function clearColumn(colIndex) {
        // remove entire column and shift everything right of it left by one
        for (let y=0;y<rows;y++) {
            for (let x=colIndex; x<cols-1; x++) {
                grid[y][x] = grid[y][x+1];
            }
            grid[y][cols-1] = null;
        }
        score += 150;
        scoreEl.textContent = score;
    }

    function clearRow(rowIndex) {
        for (let x=0;x<cols;x++) grid[rowIndex][x] = null;
        // let rows above fall down
        for (let y = rowIndex; y>0; y--) {
            grid[y] = grid[y-1].slice();
        }
        grid[0] = Array.from({length:cols}, () => null);
        score += 150;
        scoreEl.textContent = score;
    }

    function handleCanvasClick(e) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const gx = Math.floor(mx / CELL);
        const gy = Math.floor(my / CELL);
        // Check if clicked on any pink block (in grid or active piece)
        let hitSpecial = false;
        let orientation = null; // 'row' or 'col'
        // check active piece
        if (current && current.special) {
            for (let b of current.shape) {
                const x = current.x + b[0];
                const y = current.y + b[1];
                if (x === gx && y === gy) {
                    hitSpecial = true;
                    // determine orientation by checking shape coords
                    const xs = current.shape.map(bb => current.x + bb[0]);
                    const ys = current.shape.map(bb => current.y + bb[1]);
                    orientation = (new Set(ys).size === 1) ? 'row' : 'col';
                    break;
                }
            }
        }
        // check locked grid blocks (special type)
        if (!hitSpecial && grid[gy] && grid[gy][gx] && grid[gy][gx].type === 'PINK') {
            hitSpecial = true;
            // detect orientation by scanning contiguous pinks in row/col
            // check row
            let rowCount = 0, colCount = 0;
            for (let x=0;x<cols;x++) if (grid[gy][x] && grid[gy][x].type === 'PINK') rowCount++;
            for (let y=0;y<rows;y++) if (grid[y][gx] && grid[y][gx].type === 'PINK') colCount++;
            orientation = (rowCount >= 4) ? 'row' : 'col';
        }

        if (hitSpecial && orientation) {
            if (orientation === 'row') clearRow(gy);
            else clearColumn(gx);
            // if active was special and we clicked it, cancel it and spawn new
            if (current && current.special) {
                spawnPiece();
            }
            draw();
        }
    }

    function rotate() {
        if (!current) return;
        const next = (current.rotIndex + 1) % current.rotations.length;
        const newShape = current.rotations[next];
        // SRS-like wall kicks simple: try 0, -1, +1
        const kicks = [0, -1, 1, -2, 2];
        for (let k of kicks) {
            current.x += k;
            const ok = !collide(0,0,newShape);
            if (ok) {
                current.rotIndex = next;
                current.shape = newShape.map(s => s.slice());
                return;
            }
            current.x -= k;
        }
    }

    function move(dx) {
        if (!current) return;
        if (!collide(dx,0)) current.x += dx;
    }

    function drop() {
        if (!current) return;
        if (!collide(0,1)) current.y++;
        else {
            lockPiece();
        }
    }

    function hardDrop() {
        if (!current) return;
        while(!collide(0,1)) current.y++;
        lockPiece();
    }

    function step() {
        if (!running) return;
        if (!current) spawnPiece();
        if (!collide(0,1)) current.y++;
        else lockPiece();
        draw();
    }

    function draw() {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        // background grid
        for (let y=0;y<rows;y++) {
            for (let x=0;x<cols;x++) {
                ctx.fillStyle = '#f8f8f8';
                ctx.fillRect(x*CELL, y*CELL, CELL, CELL);
                ctx.strokeStyle = '#ccc';
                ctx.strokeRect(x*CELL, y*CELL, CELL, CELL);
                const cell = grid[y][x];
                if (cell) {
                    ctx.fillStyle = cell.color;
                    ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);    
                    ctx.drawImage(cell.color === COLORS.PINK ? cliopinkimage : clioimage, x*CELL+1, y*CELL+1, CELL-2, CELL-2);
                }
            }
        }
        // active piece
        if (current) {
            for (let b of current.shape) {
                const x = current.x + b[0];
                const y = current.y + b[1];
                if (y >= 0) {
                    ctx.fillStyle = current.color;
                    ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
                    // ctx.strokeStyle = '#0006';
                    ctx.strokeRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
                    // keep resized images crisp
                    ctx.imageSmoothingEnabled = false;
                    // ctx.drawImage(current.type === 'PINK' ? cliopinkimage : clioimage, x*CELL+1, y*CELL+1, CELL-2, CELL-2);
                    ctx.drawImage(current.type === 'PINK' ? cliopinkimage : clioimage, x*CELL+1, y*CELL+1,22,22);
                }
            }
        }
    }

    function restart() {
        restartBtn.textContent = 'Restart';
        clearInterval(gameInterval);
        initGrid();
        current = null;
        score = 0;
        scoreEl.textContent = score;
        running = true;
        spawnPiece();
        draw();
        gameInterval = setInterval(step, dropTime);
    }

    document.addEventListener('keydown', (e) => {
        if (!running) return;
        if (e.key === 'ArrowLeft') { move(-1); draw(); }
        else if (e.key === 'ArrowRight') { move(1); draw(); }
        else if (e.key === 'ArrowDown') { drop(); draw(); }
        else if (e.key === ' ') { e.preventDefault(); hardDrop(); draw(); }
        else if (e.key.toLowerCase() === 'z' || e.key === 'ArrowUp') { rotate(); draw(); }
        else if (e.key.toLowerCase() === 'g') { console.log('s');initGrid(); draw(); }
    });

    canvas.addEventListener('click', handleCanvasClick);
    restartBtn.addEventListener('click', restart);

    // init

    window.onload = () => {
        initGrid();
        spawnPiece();
        draw();
        // gameInterval = setInterval(step, dropTime);
    }
    const el = document.getElementById('c');

    // Rub detector settings
    const cfg = {
        requiredSignChanges: 4, // how many direction changes to consider a rub
        maxWindowMs: 800,      // time window for changes
        minMovePx: 6           // ignore tiny jitter
    };

    // Pointer-based rub detection (works for mouse/touch/pen via Pointer Events)
    let tracking = false;
    let startTime = 0;
    let lastX = 0, lastY = 0, lastSign = 0, signChanges = 0;

    function resetPointerState() {
        tracking = false;
        startTime = 0;
        lastSign = 0;
        signChanges = 0;
    }

    el.addEventListener('pointerdown', (ev) => {
        el.setPointerCapture && el.setPointerCapture(ev.pointerId);
        tracking = true;
        startTime = performance.now();
        lastX = ev.clientX;
        lastY = ev.clientY;
        lastSign = 0;
        signChanges = 0;
    });

    el.addEventListener('pointermove', (ev) => {
        if (!tracking) return;
        const now = performance.now();
        if (now - startTime > cfg.maxWindowMs) {
            // restart window
            startTime = now;
            lastSign = 0;
            signChanges = 0;
        }

        const dx = ev.clientX - lastX;
        const dy = ev.clientY - lastY;
        lastX = ev.clientX;
        lastY = ev.clientY;

        // pick dominant axis for this motion sample
        const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
        const delta = axis === 'x' ? dx : dy;
        if (Math.abs(delta) < cfg.minMovePx) return;

        const sign = delta > 0 ? 1 : -1;
        if (lastSign !== 0 && sign !== lastSign) signChanges++;
        lastSign = sign;

        if (signChanges >= cfg.requiredSignChanges && (now - startTime) <= cfg.maxWindowMs) {
            const rect = el.getBoundingClientRect();
            const detail = { x: ev.clientX - rect.left, y: ev.clientY - rect.top, axis };
            el.dispatchEvent(new CustomEvent('onrub', { detail }));
            resetPointerState();
        }
    });

    el.addEventListener('pointerup', (ev) => {
        el.releasePointerCapture && el.releasePointerCapture(ev.pointerId);
        resetPointerState();
    });

    el.addEventListener('pointercancel', resetPointerState);

    // Wheel-based rub detection (useful for trackpads that emit alternating small wheel events)
    let wheelEvents = [];
    const wheelWindowMs = 600;
    window.addEventListener('wheel', (ev) => {
        const t = performance.now();
        const s = Math.sign(ev.deltaY || ev.deltaX || 0);
        wheelEvents.push({ s, t });
        // keep only recent events
        wheelEvents = wheelEvents.filter(e => t - e.t <= wheelWindowMs);
        // count sign changes
        let changes = 0;
        for (let i = 1; i < wheelEvents.length; i++) {
            if (wheelEvents[i].s !== wheelEvents[i - 1].s) changes++;
        }
        // if many alternating tiny wheel events, treat as rub
        if (changes >= 4 && wheelEvents.length >= 6) {
            const rect = el.getBoundingClientRect();
            const x = Math.min(Math.max((ev.clientX - rect.left) | 0, 0), el.width - 1);
            const y = Math.min(Math.max((ev.clientY - rect.top) | 0, 0), el.height - 1);
            el.dispatchEvent(new CustomEvent('onrub', { detail: { x, y, axis: 'wheel' } }));
            wheelEvents = [];
        }
    }, { passive: true });

    // Add arrow buttons for mobile play
    const controls = document.createElement('div');
    controls.id = 'mobilecontrols';

    const leftButton = document.createElement('button');
    leftButton.textContent = '←';
    leftButton.onclick = () => { move(-1); draw(); };

    const rotateButton = document.createElement('button');
    rotateButton.textContent = '⟳';
    rotateButton.onclick = () => { rotate(); draw(); };

    const rightButton = document.createElement('button');
    rightButton.textContent = '→';
    rightButton.onclick = () => { move(1); draw(); };

    const dropButton = document.createElement('button');
    dropButton.textContent = '↓';
    dropButton.onclick = () => { drop(); draw(); };

    const hardDropButton = document.createElement('button');
    hardDropButton.textContent = '⤓';
    hardDropButton.onclick = () => { hardDrop(); draw(); };

    controls.appendChild(leftButton);
    controls.appendChild(rotateButton);
    controls.appendChild(rightButton);
    controls.appendChild(dropButton);
    controls.appendChild(hardDropButton);

    document.body.appendChild(controls);

    const dialog = document.querySelector("dialog");
    const howtobtn = document.getElementById("howtoBtn");
    howtobtn.addEventListener("click", () => {
        dialog.showModal();
    });
})();
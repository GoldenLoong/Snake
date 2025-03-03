// 贪吃蛇游戏主程序
// 可配置参数说明：
// 1. gridSize: 网格大小，决定蛇和食物的大小
// 2. gameSpeed: 初始游戏速度，数值越大蛇移动越慢
// 3. baseSpeed: 基础速度，用于重置和计算加速
// 4. comboTimeWindow: 连击时间窗口(秒)
// 5. comboScoreMultiplier: 连击分数倍数
// 6. effectDuration: 特效持续时间(帧)
// 7. effectSpeed: 特效上升速度
// 8. starRadius: 星星大小
// 9. starColor: 星星颜色

document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const timerElement = document.getElementById('timer');
    const comboElement = document.getElementById('combo');
    const comboTimeElement = document.getElementById('comboTime');
    const speedElement = document.getElementById('speed');
    const restartBtn = document.getElementById('restartBtn');
    const historyBtn = document.getElementById('historyBtn');
    const autoPlayBtn = document.getElementById('autoPlayBtn');
    const historyModal = document.getElementById('historyModal');
    const modalOverlay = document.getElementById('modalOverlay');
    const historyList = document.getElementById('historyList');

    // ===== 游戏配置参数 - 可自由调整 =====
    const gridSize = 20;      // 网格大小，决定蛇和食物的大小
    const tileCount = 400 / gridSize;  // 保持基于400x400的网格系统



    let isCollisionAvoidanceEnabled = false; // 是否启用防碰撞逻辑
    let currentTarget = null; // 当前预判点位


    // 游戏速度配置（格/秒）
    const initialSpeed = 5;    // 初始速度（格/秒）
    let gameSpeed = initialSpeed;  // 当前速度
    let baseSpeed = initialSpeed;  // 基础速度
    const speedIncrement = 2;    // 每次加速增加的速度（格/秒）
    const speedScoreInterval = 100;  // 基础分数间隔
    const maxSpeed = 20;      // 最大速度限制（格/秒）
    const comboSpeedBoost = 3;   // combo时的额外加速（格/秒）
    
    // 新增：画布尺寸自适应
    function resizeCanvas() {
        const canvasSize = Math.min(window.innerWidth * 0.6, window.innerHeight * 0.6);
        canvas.style.width = canvasSize + 'px';
        canvas.style.height = canvasSize + 'px';
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // 初始调用





    // 计算基于分数的速度增加值
    function calculateSpeedIncrease(score) {
        // 找出最大的10的幂次方，且该数乘以基础分数间隔小于等于当前分数
        let maxPower = Math.floor(Math.log10(score / speedScoreInterval));
        if (maxPower < 0) return 0;
        
        // 计算速度增加值：每到达一个新的量级增加一次速度
        return maxPower * speedIncrement;
    }
    
    // 将格/秒转换为毫秒/格
    function speedToInterval(speedInGridsPerSecond) {
        return 1000 / speedInGridsPerSecond;
    }

    // 游戏循环间隔（毫秒）
    let gameInterval = speedToInterval(gameSpeed);
    
    // 连击系统配置
    const comboTimeWindow = 5;         // 连击时间窗口(秒)
    const comboScoreMultiplier = 2;    // 连击分数倍数
    
    // 特效配置
    const effectDuration = 5;         // 特效持续时间(帧)
    const effectSpeed = 5;            // 特效上升速度(像素/帧)
    const starRadius = 10;            // 星星大小
    const starPoints = 5;             // 星星角数
    const starColor = 'gold';         // 星星颜色
    const starSpacing = 15;           // 多星特效的间距
    const comboTextSize = '20px';      // COMBO文字大小
    const comboTextColor = 'gold';     // COMBO文字颜色
    const comboTextStroke = '#FF4444'; // COMBO文字描边颜色
    // ===== 配置参数结束 =====

    // 游戏状态变量
    let snake = [{ x: 10, y: 10 }];  // 蛇的初始位置
    let food = { x: 15, y: 15 };     // 食物的初始位置
    let dx = 0;                      // X方向移动
    let dy = 0;                      // Y方向移动
    let score = 0;                   // 分数
    let gameLoop;                    // 主游戏循环
    let gameTime = 0;                // 游戏时间(秒)
    let timerInterval;               // 计时器间隔
    let lastFoodTime = 0;            // 上次吃到食物的时间
    let comboMultiplier = 1;         // 连击倍数
    let effects = [];                // 特效数组
    let lastDirection = { dx: 0, dy: 0 }; // 记录上一次的移动方向
    let directionQueue = [];         // 方向变化队列
    let gameStarted = false;         // 游戏是否已开始
    let currentBaseSpeed = gameSpeed; // 当前基础速度（不包含combo加速）
    let gameHistory = JSON.parse(localStorage.getItem('snakeGameHistory') || '[]');
    let isAutoPlaying = false;
    let autoPlayInterval;
    let lastDirectionChangeTime = 0;  // 上次改变方向的时间
    const DIRECTION_LOCK_TIME = 500;  // 方向锁定时间（毫秒）

    /**
     * 格式化时间
     * @param {number} seconds - 秒数
     * @returns {string} 格式化后的时间字符串
     */
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * 更新计时器
     */
    function updateTimer() {
        if (gameStarted) {
            gameTime++;
            timerElement.textContent = formatTime(gameTime);
        }
        
        // 检查combo是否过期
        if (gameTime - lastFoodTime > comboTimeWindow && comboMultiplier > 1) {
            comboMultiplier = 1;
            comboElement.textContent = 'x1';
            comboElement.style.fontSize = '16px';
            
            // 重置速度到当前基础速度（根据分数计算）
            baseSpeed = Math.min(maxSpeed, initialSpeed + calculateSpeedIncrease(score));
            gameSpeed = baseSpeed;
            gameInterval = speedToInterval(gameSpeed);
            clearInterval(gameLoop);
            gameLoop = setInterval(drawGame, gameInterval);
            updateSpeedDisplay();
        }
        
        // 更新combo剩余时间
        if (comboMultiplier > 1) {
            const remainingTime = comboTimeWindow - (gameTime - lastFoodTime);
            comboTimeElement.textContent = remainingTime;
        } else {
            comboTimeElement.textContent = '0';
        }
    }

    /**
     * 绘制星星
     * @param {number} x - 星星的X坐标
     * @param {number} y - 星星的Y坐标
     * @param {number} radius - 星星的半径
     * @param {number} points - 星星的角数
     * @param {string} color - 星星的颜色
     */
    function drawStar(x, y, radius, points, color) {
        ctx.beginPath();
        ctx.fillStyle = color;
        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? radius : radius / 2;
            const angle = (i * Math.PI) / points;
            if (i === 0) {
                ctx.moveTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
            } else {
                ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
            }
        }
        ctx.closePath();
        ctx.fill();
    }

    /**
     * 添加特效
     * @param {number} x - 特效的X坐标
     * @param {number} y - 特效的Y坐标
     * @param {number} count - 特效的数量
     */
    function addEffect(x, y, count = 1) {
        const stars = [];
        for (let i = 0; i < count; i++) {
            stars.push({
                x: x * gridSize + gridSize / 2,
                y: y * gridSize + gridSize / 2,
                opacity: 1,
                offsetX: i * starSpacing - ((count - 1) * starSpacing) / 2
            });
        }
        effects.push({
            stars,
            duration: effectDuration
        });
    }

    /**
     * 更新特效
     */
    function updateEffects() {
        effects = effects.filter(effect => {
            effect.duration--;
            effect.stars.forEach(star => {
                star.y -= effectSpeed;
                star.opacity = effect.duration / effectDuration;
            });
            return effect.duration > 0;
        });
    }

    /**
     * 绘制特效
     */
    function drawEffects() {
        effects.forEach(effect => {
            effect.stars.forEach(star => {
                ctx.globalAlpha = star.opacity;
                drawStar(star.x + star.offsetX, star.y, starRadius, starPoints, starColor);
                
                // 在星星上方绘制COMBO文字
                if (comboMultiplier > 1) {
                    ctx.font = `bold ${comboTextSize} Arial`;
                    ctx.textAlign = 'center';
                    ctx.strokeStyle = comboTextStroke;
                    ctx.lineWidth = 3;
                    ctx.strokeText('COMBO', star.x + star.offsetX, star.y - 20);
                    ctx.fillStyle = comboTextColor;
                    ctx.fillText('COMBO', star.x + star.offsetX, star.y - 20);
                }
            });
        });
        ctx.globalAlpha = 1;
    }

    /**
     * 改变方向
     * @param {KeyboardEvent} event - 键盘事件
     */
    function changeDirection(event) {
        if (isAutoPlaying) return; // 自动玩时禁用玩家输入

        const LEFT_KEY = 37;
        const RIGHT_KEY = 39;
        const UP_KEY = 38;
        const DOWN_KEY = 40;

        const keyPressed = event.keyCode;
        const goingUp = lastDirection.dy === -1;
        const goingDown = lastDirection.dy === 1;
        const goingRight = lastDirection.dx === 1;
        const goingLeft = lastDirection.dx === -1;

        let newDx = dx;
        let newDy = dy;

        if (keyPressed === LEFT_KEY && !goingRight) {
            newDx = -1;
            newDy = 0;
            gameStarted = true;  // 开始游戏
        }
        if (keyPressed === UP_KEY && !goingDown) {
            newDx = 0;
            newDy = -1;
            gameStarted = true;  // 开始游戏
        }
        if (keyPressed === RIGHT_KEY && !goingLeft) {
            newDx = 1;
            newDy = 0;
            gameStarted = true;  // 开始游戏
        }
        if (keyPressed === DOWN_KEY && !goingUp) {
            newDx = 0;
            newDy = 1;
            gameStarted = true;  // 开始游戏
        }

        // 如果是新的方向，加入队列
        if (newDx !== dx || newDy !== dy) {
            directionQueue.push({ dx: newDx, dy: newDy });
        }
    }

    /**
     * 绘制游戏
     */
    function drawGame() {
        clearCanvas();
        moveSnake();
        
        if (hasGameEnded()) {
            gameOver();
            return;
        }
        
        drawFood();
        drawSnake();
        drawEffects();
        updateEffects();
    }

    /**
     * 清空画布
     */
    function clearCanvas() {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    /**
     * 绘制蛇
     */
    function drawSnake() {
        ctx.fillStyle = 'green';

        snake.forEach(segment => {
            ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 2, gridSize - 2);
        });
    }

    /**
     * 绘制食物
     */
    function drawFood() {
        ctx.fillStyle = 'red';

        ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize - 2, gridSize - 2);
    }

    /**
     * 移动蛇
     */
    function moveSnake() {
        // 从队列中获取下一个方向
        if (directionQueue.length > 0) {
            const nextDirection = directionQueue[0];
            // 检查是否与当前移动方向相反
            if (!((nextDirection.dx === 1 && lastDirection.dx === -1) ||
                  (nextDirection.dx === -1 && lastDirection.dx === 1) ||
                  (nextDirection.dy === 1 && lastDirection.dy === -1) ||
                  (nextDirection.dy === -1 && lastDirection.dy === 1))) {
                dx = nextDirection.dx;
                dy = nextDirection.dy;
            }
            directionQueue.shift();
        }

        const head = { x: snake[0].x + dx, y: snake[0].y + dy };
        
        // 更新最后的移动方向
        lastDirection.dx = dx;
        lastDirection.dy = dy;
        
        if (head.x < 0) {
            head.x = tileCount - 1;
        } else if (head.x >= tileCount) {
            head.x = 0;
        }
        
        if (head.y < 0) {
            head.y = tileCount - 1;
        } else if (head.y >= tileCount) {
            head.y = 0;
        }
        
        snake.unshift(head);
        if (!hasEatenFood()) {
            snake.pop();
        }
    }

    /**
     * 判断是否吃到食物
     * @returns {boolean} 是否吃到食物
     */
    function hasEatenFood() {
        const head = snake[0];
        if (head.x === food.x && head.y === food.y) {
            const currentTime = gameTime;
            const timeDiff = currentTime - lastFoodTime;
            
            // 更新基础速度（根据分数计算）
            baseSpeed = Math.min(maxSpeed, initialSpeed + calculateSpeedIncrease(score));
            
            if (timeDiff <= comboTimeWindow) {
                // ==== 新增：连击倍率上限 ====
                comboMultiplier = Math.min(comboMultiplier * comboScoreMultiplier, 1000000);
                addEffect(head.x, head.y, 3);
                const fontSize = Math.min(16 + (comboMultiplier * 2), 40);
                comboElement.style.fontSize = `${fontSize}px`;
                
                // Combo加速
                gameSpeed = Math.min(maxSpeed, baseSpeed + comboSpeedBoost);
            } else {
                comboMultiplier = 1;
                addEffect(head.x, head.y, 1);
                comboElement.style.fontSize = '16px';
                gameSpeed = baseSpeed;
            }
            
            // 更新游戏循环间隔
            gameInterval = speedToInterval(gameSpeed);
            clearInterval(gameLoop);
            gameLoop = setInterval(drawGame, gameInterval);
            updateSpeedDisplay();
            
            comboElement.textContent = `x${comboMultiplier}`;
            lastFoodTime = currentTime;
            
            score += 10 * comboMultiplier;
            scoreElement.textContent = score;
            
            generateFood();
            return true;
        }
        return false;
    }

    /**
     * 生成食物
     */
    function generateFood() {
        const isDangerPosition = (x, y) => {
            // 临时模拟蛇吃到食物后的状态
            const tempSnake = [{x, y}, ...snake];
            
            // 检查四个移动方向是否都会被包围
            const directions = [
                [1, 0], [-1, 0], [0, 1], [0, -1]
            ];
            
            return directions.every(([dx, dy]) => {
                const newX = (x + dx + tileCount) % tileCount;
                const newY = (y + dy + tileCount) % tileCount;
                
                // 检查移动后是否碰到蛇身(包含新增长的身体)
                return tempSnake.some(segment => 
                    segment.x === newX && segment.y === newY
                );
            });
        };
    
        let isValid = false;
        let retryCount = 0;
        
        do {
            food.x = Math.floor(Math.random() * tileCount);
            food.y = Math.floor(Math.random() * tileCount);
            
            // 检查是否与蛇身重叠
            const onSnake = snake.some(segment => 
                segment.x === food.x && segment.y === food.y
            );
            
            // 新增：检查是否会导致立即死亡
            const willDie = isDangerPosition(food.x, food.y);
            
            isValid = !onSnake && !willDie;
            
            // 防止无限循环，最多重试50次
            if (retryCount++ > 500) break; 
        } while (!isValid);
    
        // 最终安全检查
        if (isDangerPosition(food.x, food.y)) {
            // 强制生成安全位置
            const safeSpots = [];
            for(let x=0; x<tileCount; x++){
                for(let y=0; y<tileCount; y++){
                    if(!isDangerPosition(x,y) && !snake.some(s=>s.x===x&&s.y===y)){
                        safeSpots.push({x,y});
                    }
                }
            }
            if(safeSpots.length > 0){
                const randomIndex = Math.floor(Math.random()*safeSpots.length);
                food = safeSpots[randomIndex];
            }
        }
    }




    /**
     * 判断游戏是否结束
     * @returns {boolean} 游戏是否结束
     */
    function hasGameEnded() {
        const head = snake[0];
        
        for (let i = 1; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * 游戏结束
     */
    function gameOver() {
        clearInterval(gameLoop);
        clearInterval(timerInterval);
        clearInterval(autoPlayInterval);
        isAutoPlaying = false;
        autoPlayBtn.classList.remove('active');
        
        // 更新历史记录
        updateHistory(score);
        
        ctx.fillStyle = 'black';
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('\u6E38\u620F\u7ED3\u675F!', canvas.width / 2, canvas.height / 2);
        ctx.font = '20px Arial';
        ctx.fillText('\u70B9\u51FB\u7A7A\u95F4\u91CD\u542F\u6E38\u620F', canvas.width / 2, canvas.height / 2 + 40);
        
        document.addEventListener('keydown', function restart(event) {
            if(isAutoPlaying) return; // 自动玩时忽略方向键

            if (event.code === 'Space') {
                document.removeEventListener('keydown', restart);
                startGame();
            }
        });
    }

    /**
     * 开始游戏
     */
    function startGame() {
        clearInterval(gameLoop);
        clearInterval(timerInterval);
        clearInterval(autoPlayInterval);
        isAutoPlaying = false;
        autoPlayBtn.classList.remove('active');
        
        snake = [{ x: 10, y: 10 }];
        food = { x: 15, y: 15 };
        dx = 0;
        dy = 0;
        score = 0;
        gameTime = 0;
        lastFoodTime = 0;
        comboMultiplier = 1;
        effects = [];
        gameSpeed = initialSpeed;  // 重置为初始速度
        baseSpeed = initialSpeed;  // 重置基础速度
        gameInterval = speedToInterval(gameSpeed);
        gameStarted = false;  // 重置游戏开始状态
        
        comboElement.textContent = 'x1';
        scoreElement.textContent = score;
        timerElement.textContent = '0:00';
        comboElement.style.fontSize = '16px';
        updateSpeedDisplay();  // 更新速度显示
        
        gameLoop = setInterval(drawGame, gameInterval);
        timerInterval = setInterval(updateTimer, 1000);
    }

    /**
     * 更新速度显示
     */
    function updateSpeedDisplay() {
        speedElement.textContent = Math.floor(gameSpeed);
    }

    /**
     * 更新历史记录
     * @param {number} newScore - 新的分数
     */
    function updateHistory(newScore) {
        const now = new Date();
        const record = {
            score: newScore,
            time: gameTime,
            timestamp: now.toLocaleString('zh-CN', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            })
        };
        gameHistory.push(record);
        gameHistory.sort((a, b) => b.score - a.score);
        gameHistory = gameHistory.slice(0, 10); // 只保留前10名
        localStorage.setItem('snakeGameHistory', JSON.stringify(gameHistory));
        
        // 更新历史记录显示
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';
        gameHistory.forEach((record, index) => {
            const minutes = Math.floor(record.time / 60);
            const seconds = record.time % 60;
            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="rank">#${index + 1}</div>
                <div class="score">${record.score}\u5206</div>
                <div class="time">${timeStr}</div>
                <div class="date">${record.timestamp}</div>
            `;
            historyList.appendChild(item);
        });
    }

    /**
     * 显示历史记录
     */
    function showHistory() {
        historyModal.style.display = 'block';
        modalOverlay.style.display = 'block';
    }

    /**
     * 开始/停止自动玩
     */
    function toggleAutoPlay() {
        isAutoPlaying = !isAutoPlaying;
        isCollisionAvoidanceEnabled = isAutoPlaying; // 启用防碰撞逻辑
        autoPlayBtn.classList.toggle('active');
        
        if (isAutoPlaying) {
            autoPlayInterval = setInterval(autoPlay, 10);
        } else {
            clearInterval(autoPlayInterval);
        }
    }
    



    /**
     * 机器人自动玩
     */
    function autoPlay() {
        if (!isAutoPlaying) return;
        const head = snake[0];
        let target = food;
    
        // ==== 新增：处理穿墙后的头部坐标 ====
        const normalizedHead = {
            x: (head.x + tileCount) % tileCount,
            y: (head.y + tileCount) % tileCount
        };
    
        if (isCollisionAvoidanceEnabled) {
            // ==== 修改：传入标准化后的头部坐标 ====
            const safePath = findSafePath(normalizedHead, food);
            if (safePath.length > 0) {
                target = safePath[0];
            } else {
                target = findFallbackTarget(normalizedHead);
            }
        }
    
        // ==== 修改：计算真实距离（考虑穿墙）====
        let realDeltaX = (target.x - normalizedHead.x + tileCount) % tileCount;
        let realDeltaY = (target.y - normalizedHead.y + tileCount) % tileCount;
        
        // 调整最短路径方向
        if (realDeltaX > tileCount/2) realDeltaX -= tileCount;
        if (realDeltaY > tileCount/2) realDeltaY -= tileCount;
    
        // ==== 原有方向计算逻辑保持不变 ====
        let newDx = dx;
        let newDy = dy;
    
        if (Math.abs(realDeltaX) > Math.abs(realDeltaY)) {
            newDx = realDeltaX > 0 ? 1 : -1;
            newDy = 0;
        } else {
            newDx = 0;
            newDy = realDeltaY > 0 ? 1 : -1;
        }
    
        // 检查反向移动
        if ((dx !== 0 && newDx === -dx) || (dy !== 0 && newDy === -dy)) {
            return;
        }
    
        dx = newDx;
        dy = newDy;
    }
    



    
    // 新增辅助函数
    function isPositionSafe(x, y) {
        // ==== 新增：坐标标准化 ====
        const normalizedX = (x + tileCount) % tileCount;
        const normalizedY = (y + tileCount) % tileCount;
        
        return !snake.some(segment => {
            const segX = (segment.x + tileCount) % tileCount;
            const segY = (segment.y + tileCount) % tileCount;
            return segX === normalizedX && segY === normalizedY;
        });
    }




    function findSafePath(start, end) {
        const visited = new Set();
        const queue = [[start.x, start.y, []]];
        
        while (queue.length > 0) {
            let [x, y, path] = queue.shift();
            
            // ==== 新增：坐标标准化 ====
            x = (x + tileCount) % tileCount;
            y = (y + tileCount) % tileCount;
            
            if (x === end.x && y === end.y) {
                return path;
            }
            
            const neighbors = [
                [x + 1, y], [x - 1, y],
                [x, y + 1], [x, y - 1]
            ].map(([nx, ny]) => [
                (nx + tileCount) % tileCount, 
                (ny + tileCount) % tileCount
            ]);
            
            for (const [nx, ny] of neighbors) {
                const key = `${nx},${ny}`;
                if (!visited.has(key) && isPositionSafe(nx, ny)) {
                    visited.add(key);
                    queue.push([nx, ny, [...path, {x: nx, y: ny}]]);
                }
            }
        }
        return [];
    }


    

    function findFallbackTarget(head) {
        // 寻找最近的安全点
        const directions = [
            [1, 0], [-1, 0], [0, 1], [0, -1]
        ];
        
        for (const [dx, dy] of directions) {
            const x = head.x + dx;
            const y = head.y + dy;
            if (isPositionSafe(x, y)) {
                return {x, y};
            }
        }
        return head; // 没有安全点时保持原方向
    }





    // 添加事件监听器
    document.addEventListener('keydown', function(event) {
        // \u9632\u6b62\u65b9\u5411\u952e\u8fdb\u884c\u9875\u9762\u6ed1\u52a8
        if([32, 37, 38, 39, 40].indexOf(event.keyCode) > -1) {
            event.preventDefault();
        }
        changeDirection(event);
    });
    restartBtn.addEventListener('click', startGame);
    historyBtn.addEventListener('click', showHistory);
    autoPlayBtn.addEventListener('click', toggleAutoPlay);
    modalOverlay.addEventListener('click', () => {
        historyModal.style.display = 'none';
        modalOverlay.style.display = 'none';
    });
    
    // \u542f\u52a8\u6e38\u620F
    startGame();
});

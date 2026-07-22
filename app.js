/* ==========================================================================
   阿黑的客字繪卷 客語排列遊戲 Logic System
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // State variables
    let questions = [];
    let currentQuestionIndex = 0;
    let selectedBlocks = []; 
    let remainingBlocks = []; 
    
    let correctCount = 0;
    let totalScore = 0;
    let questionScore = 10; // Starts at 10 points per question
    
    let gameStartTime = null;
    let questionStartTime = null;
    let totalElapsedSeconds = 0;
    let isAnswerSubmitted = false;
    let draggedBlockId = null;
    let wrongBreakX = null;
    let questionBaseSpeed = 2.0;
    let shouldAutoTransition = false;
    let isTransitioning = false;
    let flashTimer = 0;

    // Audio Element & Controls
    const gameAudio = document.getElementById('game-audio');
    const playAudioBtn = document.getElementById('play-audio-btn');
    const soundwave = document.getElementById('soundwave');

    const sfxPath = 'data/music/';
    const sfxVersion = '20260722-1';
    const sfx = {
        click: new Audio(`${sfxPath}S2_m2_click.mp3?v=${sfxVersion}`),
        wrong: new Audio(`${sfxPath}S2_m2_false.mp3?v=${sfxVersion}`),
        next: new Audio(`${sfxPath}S2_m2_next.mp3?v=${sfxVersion}`),
        splash: new Audio(`${sfxPath}S2_m3_splash.mp3?v=${sfxVersion}`)
    };

    function playSfx(name) {
        const audio = sfx[name];
        if (!audio) return;

        audio.currentTime = 0;
        audio.volume = 0.75;
        audio.play().catch(() => {});
    }
    
    // UI Elements
    const introCard = document.getElementById('intro-card');
    const startAdventureBtn = document.getElementById('start-adventure-btn');
    const gameCard = document.getElementById('game-card');
    const resultsCard = document.getElementById('results-card');
    const displayLevel = document.getElementById('display-level');
    const questionNumber = document.getElementById('question-number');
    const scoreDisplay = document.getElementById('score-display');
    const progressBar = document.getElementById('progress-bar');
    const questionCategory = document.getElementById('question-category');
    
    const hintBtn = document.getElementById('hint-btn');
    const hintText = document.getElementById('hint-text');
    const helpBgBtn = document.getElementById('help-bg-btn');
    
    const answerContainer = document.getElementById('answer-container');
    const candidatesContainer = document.getElementById('candidates-container');
    
    const clearBtn = document.getElementById('clear-btn');
    const submitBtn = document.getElementById('submit-btn');
    
    // Feedback Panel
    const feedbackPanel = document.getElementById('feedback-panel');
    const feedbackStatus = document.getElementById('feedback-status');
    const feedbackHakkaHanji = document.getElementById('feedback-hakka-hanji');
    const feedbackTranslation = document.getElementById('feedback-translation');
    const nextBtn = document.getElementById('next-btn');
    
    // Results Panel
    const resultScore = document.getElementById('result-score');
    const resultAccuracy = document.getElementById('result-accuracy');
    const resultTime = document.getElementById('result-time');
    const restartBtn = document.getElementById('restart-btn');

    // Speed buttons
    const speedButtons = document.querySelectorAll('.speed-btn');

    // ---------------------------------------------------------
    // 2D HTML5 Canvas Runner Game Engine
    // ---------------------------------------------------------
    const canvas = document.getElementById('runner-canvas');
    const ctx = canvas.getContext('2d');
    
    const canvasWidth = 960;
    const canvasHeight = 200;
    const groundY = 140;
    const riverY = 175;
    
    let scrollX = 0;
    let skyScrollX = 0;
    let mountainScrollX = 0;
    let forestScrollX = 0;
    
    let speedMultiplier = 1.0;
    const baseSpeed = 2.0; 
    let activeSpeed = 2.0;
    
    let dogX = 180;
    let dogY = groundY;
    let dogState = 'running'; // 'running', 'crossing', 'falling', 'splashing', 'recovering'
    let dogFrame = 0;
    
    // Cliff settings (Cliff width is 200px)
    let cliffX = 1200; 
    const cliffWidth = 200;
    const cliffTargetX = 230; 
    let hasCliffAppeared = false;
    
    let animationFrameId = null;
    let isGamePaused = false;
    
    // Splash & sparkles particles
    let splashParticles = [];
    let sparkles = [];
    let bridgeAlpha = 0.0;
    let isBridgeTransparent = false;
    let isBridgeBroken = false;

    const runnerAssetPath = 'data/image/';
    const runnerAssetVersion = '20260722-7';
    const useRunnerImageLayers = true;
    const runnerAssets = {
        mountains: loadRunnerImage('S2_m3_yamaloop.png'),
        village: loadRunnerImage('S2_m3_village.png'),
        grass: loadRunnerImage('S2_m3_grass.png'),
        floorLoop: loadRunnerImage('S2_m3_floorloop.png'),
        floorLeft: loadRunnerImage('S2_m3_floorL.png'),
        floorRight: loadRunnerImage('S2_m3_floorR.png'),
        bridge: loadRunnerImage('S2_m3_bridgeA.png'),
        brokenBridge: loadRunnerImage('S2_m3_bridgeB.png'),
        kuroRun: loadRunnerImage('S2_m3_kuro_run.png')
    };

    function loadRunnerImage(fileName) {
        const image = new Image();
        image.src = `${runnerAssetPath}${fileName}?v=${runnerAssetVersion}`;
        return image;
    }

    function isImageReady(image) {
        return image && image.complete && image.naturalWidth > 0;
    }

    function getScaledRunnerLayer(image, height, trimX = 0) {
        if (!isImageReady(image)) return null;

        const sourceX = trimX;
        const sourceWidth = image.naturalWidth - trimX * 2;
        const cacheKey = `${Math.round(height)}:${trimX}`;

        if (image._runnerLayerCache && image._runnerLayerCache.key === cacheKey) {
            return image._runnerLayerCache;
        }

        const layer = document.createElement('canvas');
        layer.height = Math.ceil(height);
        layer.width = Math.ceil(sourceWidth * (height / image.naturalHeight));

        const layerCtx = layer.getContext('2d');
        layerCtx.imageSmoothingEnabled = true;
        layerCtx.imageSmoothingQuality = 'high';
        layerCtx.drawImage(
            image,
            sourceX,
            0,
            sourceWidth,
            image.naturalHeight,
            0,
            0,
            layer.width,
            layer.height
        );

        image._runnerLayerCache = {
            key: cacheKey,
            canvas: layer,
            width: layer.width,
            height: layer.height
        };

        return image._runnerLayerCache;
    }

    function drawScrollingImage(image, y, height, scroll, speedScale = 1, trimX = 0) {
        if (!useRunnerImageLayers) return false;

        const layer = getScaledRunnerLayer(image, height, trimX);
        if (!layer) return false;

        const width = layer.width;
        const seamOverlap = 1;
        const offset = -((scroll * speedScale) % width);

        for (let x = offset - width; x < canvasWidth + width; x += width) {
            ctx.drawImage(
                layer.canvas,
                Math.round(x),
                Math.round(y),
                Math.ceil(width) + seamOverlap,
                layer.height
            );
        }

        return true;
    }

    function drawStretchImage(image, x, y, width, height) {
        if (!isImageReady(image)) return false;
        ctx.drawImage(image, x, y, width, height);
        return true;
    }

    function drawImageByHeight(image, x, y, height) {
        if (!isImageReady(image)) return 0;
        const width = image.naturalWidth * (height / image.naturalHeight);
        ctx.drawImage(image, x, y, width, height);
        return width;
    }

    // Helper to extract Hakka character cards excluding punctuation
    function getHakkaCharacters(text) {
        const punctuation = /[\s，。！？、；：""''（）【】《》—～·(),.!?_=\-\+\*\/&%\$#@~`<>\{\}\[\]\\\|]/g;
        return Array.from(text.replace(punctuation, ''));
    }

    // Helper to shuffle array (Fisher-Yates algorithm)
    function shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // Helper to build Chinese sentence with punctuation matching Hakka phrasing
    function getChineseSentenceWithPunctuation(q) {
        const chPunctuationMap = {
            "q_listening_001": "好開心，這次考試我考一百分。",
            "q_listening_002": "太棒了，你這次一定很用功。",
            "q_listening_003": "我覺得這題數學好難喔。",
            "q_listening_004": "這一題我會，我教你。",
            "q_listening_005": "我可以幫忙做什麼？",
            "q_listening_006": "你來幫忙摺衣服。",
            "q_listening_007": "我們學校有客家山歌比賽。",
            "q_listening_008": "今天好熱，我一直流汗。",
            "q_listening_009": "主任今天穿得好漂亮喔！",
            "q_listening_010": "謝謝你借我橡皮擦。"
        };
        
        if (chPunctuationMap[q.question_id]) {
            return chPunctuationMap[q.question_id];
        }
        
        // Fallback dynamic mapping for new custom questions
        const punctuationRegex = /[\s，。！？、；：""''（）【】《》—～·(),.!?_=\-\+\*\/&%\$#@~`<>\{\}\[\]\\\|]/g;
        let hakkaClean = "";
        let punctuationList = [];
        
        for (let i = 0; i < q.hakka_hanji.length; i++) {
            const char = q.hakka_hanji[i];
            if (char.match(punctuationRegex)) {
                punctuationList.push({
                    afterCharIndex: Array.from(hakkaClean).length,
                    punctuation: char
                });
            } else {
                hakkaClean += char;
            }
        }
        
        let result = "";
        let currentChineseLength = 0;
        const totalChineseLength = Array.from(q.correct_sequence.join('')).length;
        const hakkaLength = Array.from(hakkaClean).length;
        
        for (let wIdx = 0; wIdx < q.correct_sequence.length; wIdx++) {
            const word = q.correct_sequence[wIdx];
            result += word;
            currentChineseLength += Array.from(word).length;
            
            const correspondingHakkaIndex = Math.floor(currentChineseLength * (hakkaLength / totalChineseLength));
            
            for (let pIdx = 0; pIdx < punctuationList.length; pIdx++) {
                const p = punctuationList[pIdx];
                if (p.afterCharIndex === correspondingHakkaIndex && !p.added) {
                    result += p.punctuation;
                    p.added = true;
                }
            }
        }
        
        punctuationList.forEach(p => {
            if (!p.added) {
                result += p.punctuation;
            }
        });
        
        return result;
    }

    // 1. Initial Load
    function init() {
        if (typeof questionsData !== 'undefined') {
            questions = questionsData;
            setupEventListeners();
            setupCanvasEngine();
            
            // Wait for user to click Start Adventure button to start the game
            if (startAdventureBtn && introCard) {
                startAdventureBtn.addEventListener('click', () => {
                    playSfx('click');
                    introCard.classList.add('hidden');
                    startGame();
                });
            } else {
                startGame();
            }
        } else {
            console.error('無法載入題庫資料 questionsData');
            alert('遊戲內容加載失敗，請確認 questions_data.js 是否被正確載入。');
        }
    }

    // 2. Event Listeners Setup
    function setupEventListeners() {
        // Audio Controls
        playAudioBtn.addEventListener('click', () => {
            playSfx('click');
            toggleAudio();
        });
        gameAudio.addEventListener('play', onAudioPlay);
        gameAudio.addEventListener('pause', onAudioPause);
        gameAudio.addEventListener('ended', onAudioEnded);

        // Hint Toggle
        hintBtn.addEventListener('click', () => {
            playSfx('click');
            toggleHint();
        });
        
        // Help Po Kong Skip Button
        helpBgBtn.addEventListener('click', () => {
            playSfx('click');
            askPoKongForHelp();
        });

        // Action Buttons
        clearBtn.addEventListener('click', () => {
            playSfx('click');
            clearSelection();
        });
        submitBtn.addEventListener('click', submitAnswer);
        nextBtn.addEventListener('click', () => {
            playSfx('next');
            nextQuestion();
        });
        restartBtn.addEventListener('click', () => {
            playSfx('click');
            startGame();
        });

        // Speed Controls
        speedButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                playSfx('click');
                speedButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                speedMultiplier = parseFloat(btn.dataset.speed);
                
                // Keep audio speed at 1x
                gameAudio.playbackRate = 1.0;
                activeSpeed = questionBaseSpeed * speedMultiplier;
            });
        });

        // Container Drag and Drop Drop-zones
        answerContainer.addEventListener('dragover', (e) => {
            if (isAnswerSubmitted) return;
            e.preventDefault();
        });
        
        answerContainer.addEventListener('drop', (e) => {
            if (isAnswerSubmitted) return;
            e.preventDefault();
            
            const dataIdStr = e.dataTransfer.getData('text/plain');
            const draggedId = dataIdStr ? parseInt(dataIdStr, 10) : draggedBlockId;
            
            if (draggedId === null || isNaN(draggedId)) return;
            
            if (e.target === answerContainer || e.target.classList.contains('empty-state')) {
                const dragInRemainingIdx = remainingBlocks.findIndex(b => b.id === draggedId);
                if (dragInRemainingIdx > -1) {
                    const block = remainingBlocks[dragInRemainingIdx];
                    remainingBlocks.splice(dragInRemainingIdx, 1);
                    selectedBlocks.push(block);
                    renderBlocks();
                }
            }
        });
        
        candidatesContainer.addEventListener('dragover', (e) => {
            if (isAnswerSubmitted) return;
            e.preventDefault();
        });
        
        candidatesContainer.addEventListener('drop', (e) => {
            if (isAnswerSubmitted) return;
            e.preventDefault();
            
            const dataIdStr = e.dataTransfer.getData('text/plain');
            const draggedId = dataIdStr ? parseInt(dataIdStr, 10) : draggedBlockId;
            
            if (draggedId === null || isNaN(draggedId)) return;
            
            if (e.target === candidatesContainer) {
                const dragInSelectedIdx = selectedBlocks.findIndex(b => b.id === draggedId);
                if (dragInSelectedIdx > -1) {
                    const block = selectedBlocks[dragInSelectedIdx];
                    selectedBlocks.splice(dragInSelectedIdx, 1);
                    remainingBlocks.push(block);
                    renderBlocks();
                }
            }
        });

        // Keyboard support (Space to play audio, Enter to submit/next)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.target.matches('button, input, textarea')) {
                e.preventDefault();
                toggleAudio();
            }
            if (e.code === 'Enter' && !submitBtn.disabled && !isAnswerSubmitted) {
                e.preventDefault();
                submitAnswer();
            } else if (e.code === 'Enter' && isAnswerSubmitted && !feedbackPanel.classList.contains('hidden')) {
                e.preventDefault();
                nextQuestion();
            }
        });
    }

    // 3. Start/Restart Game
    function startGame() {
        correctCount = 0;
        totalScore = 0;
        currentQuestionIndex = 0;
        totalElapsedSeconds = 0;
        gameStartTime = new Date();
        
        resultsCard.classList.add('hidden');
        gameCard.classList.remove('hidden');
        gameCard.classList.remove('fade-out');
        
        shouldAutoTransition = false;
        isTransitioning = false;
        flashTimer = 0;
        
        loadQuestion(currentQuestionIndex);
    }

    // 4. Load Question at Index
    function loadQuestion(index) {
        if (index >= questions.length) {
            showResults();
            return;
        }

        const q = questions[index];
        isAnswerSubmitted = false;
        questionScore = 10; // Start with 10 points
        questionStartTime = new Date();
        shouldAutoTransition = false;
        flashTimer = 0;

        const inlineMsg = document.getElementById('inline-feedback-msg');
        if (inlineMsg) {
            inlineMsg.textContent = '';
            inlineMsg.classList.add('hidden');
        }

        // Reset Canvas Position
        resetCanvasForQuestion(q);

        // Clear any previous play listener to avoid playing multiple files
        if (gameAudio._playListener) {
            gameAudio.removeEventListener('canplay', gameAudio._playListener);
        }

        // Stop any playing audio
        gameAudio.pause();
        gameAudio.src = q.audio_url;
        gameAudio.load();
        gameAudio.playbackRate = 1.0; // Keep audio at 1x speed

        // Update Text Info
        displayLevel.textContent = q.level + '級';
        if (questionCategory) {
            questionCategory.textContent = '';
        }
        questionNumber.textContent = `第 ${index + 1} / ${questions.length} 題`;
        scoreDisplay.textContent = `得分: ${totalScore}`;
        
        // Update Progress Bar
        const progressPercent = ((index + 1) / questions.length) * 100;
        progressBar.style.width = `${progressPercent}%`;

        // Reset Hint to Chinese translation sentence with punctuation
        hintText.textContent = getChineseSentenceWithPunctuation(q);
        hintText.classList.add('hidden');
        hintBtn.innerHTML = '<i class="fa-regular fa-lightbulb"></i> 顯示中文翻譯提示';
        hintBtn.classList.remove('btn-secondary');
        hintBtn.classList.add('btn-primary');

        // Enable Po Kong Help skip button
        helpBgBtn.disabled = false;

        // Extract Hakka characters dynamically as block cards
        const hakkaChars = getHakkaCharacters(q.hakka_hanji);
        const shuffledHakka = shuffleArray(hakkaChars);

        // Setup Blocks with Unique IDs (to handle identical strings properly)
        selectedBlocks = [];
        remainingBlocks = shuffledHakka.map((text, idx) => ({
            id: idx,
            text: text
        }));

        // Reset Panels
        feedbackPanel.classList.add('hidden');
        feedbackPanel.classList.remove('correct', 'incorrect');
        submitBtn.classList.remove('hidden');
        submitBtn.disabled = true;
        clearBtn.disabled = true;

        renderBlocks();
        
        // Auto play audio when ready
        gameAudio._playListener = function() {
            if (gameAudio.paused) {
                gameAudio.play().catch(e => {
                    console.log("Autoplay blocked: user interaction required.", e);
                });
            }
            gameAudio.removeEventListener('canplay', gameAudio._playListener);
            gameAudio._playListener = null;
        };
        gameAudio.addEventListener('canplay', gameAudio._playListener);
    }

    // 5. Render Blocks to UI
    function renderBlocks() {
        answerContainer.innerHTML = '';
        candidatesContainer.innerHTML = '';

        // Render Answer Container (Placed Blocks)
        if (selectedBlocks.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'empty-state';
            emptyEl.textContent = '從右側挑選字卡，依聽到的順序搭橋';
            answerContainer.appendChild(emptyEl);
        } else {
            selectedBlocks.forEach(block => {
                const btn = document.createElement('button');
                btn.className = 'word-block placed';
                btn.textContent = block.text;
                btn.dataset.id = block.id;
                
                if (!isAnswerSubmitted) {
                    btn.addEventListener('click', () => deselectBlock(block.id));
                    
                    // HTML5 Drag and Drop Setup
                    btn.setAttribute('draggable', 'true');
                    btn.addEventListener('dragstart', (e) => {
                        draggedBlockId = block.id;
                        btn.classList.add('dragging');
                        e.dataTransfer.setData('text/plain', String(block.id));
                    });
                    btn.addEventListener('dragend', () => {
                        btn.classList.remove('dragging');
                        draggedBlockId = null;
                        document.querySelectorAll('.word-block').forEach(el => el.classList.remove('drag-over', 'insert-before', 'insert-after'));
                    });
                    btn.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        if (draggedBlockId !== null && draggedBlockId !== block.id) {
                            const rect = btn.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            if (x < rect.width / 2) {
                                btn.classList.add('insert-before');
                                btn.classList.remove('insert-after');
                            } else {
                                btn.classList.add('insert-after');
                                btn.classList.remove('insert-before');
                            }
                        }
                    });
                    btn.addEventListener('dragenter', (e) => {
                        e.preventDefault();
                        if (draggedBlockId !== null && draggedBlockId !== block.id) {
                            btn.classList.add('drag-over');
                        }
                    });
                    btn.addEventListener('dragleave', () => {
                        btn.classList.remove('drag-over', 'insert-before', 'insert-after');
                    });
                    btn.addEventListener('drop', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const rect = btn.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const dropAfter = x >= rect.width / 2;
                        
                        btn.classList.remove('drag-over', 'insert-before', 'insert-after');
                        const dataIdStr = e.dataTransfer.getData('text/plain');
                        const draggedId = dataIdStr ? parseInt(dataIdStr, 10) : draggedBlockId;
                        if (draggedId !== null && !isNaN(draggedId) && draggedId !== block.id) {
                            handleBlockDrop(draggedId, block.id, dropAfter);
                        }
                    });
                } else {
                    btn.style.cursor = 'default';
                }
                
                answerContainer.appendChild(btn);
            });
        }

        // Render Candidate Container
        remainingBlocks.forEach(block => {
            const btn = document.createElement('button');
            btn.className = 'word-block';
            btn.textContent = block.text;
            btn.dataset.id = block.id;

            if (!isAnswerSubmitted) {
                btn.addEventListener('click', () => selectBlock(block.id));
                
                // HTML5 Drag and Drop Setup
                btn.setAttribute('draggable', 'true');
                btn.addEventListener('dragstart', (e) => {
                    draggedBlockId = block.id;
                    btn.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', String(block.id));
                });
                btn.addEventListener('dragend', () => {
                    btn.classList.remove('dragging');
                    draggedBlockId = null;
                    document.querySelectorAll('.word-block').forEach(el => el.classList.remove('drag-over', 'insert-before', 'insert-after'));
                });
                btn.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (draggedBlockId !== null && draggedBlockId !== block.id) {
                        const rect = btn.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        if (x < rect.width / 2) {
                            btn.classList.add('insert-before');
                            btn.classList.remove('insert-after');
                        } else {
                            btn.classList.add('insert-after');
                            btn.classList.remove('insert-before');
                        }
                    }
                });
                btn.addEventListener('dragenter', (e) => {
                    e.preventDefault();
                    if (draggedBlockId !== null && draggedBlockId !== block.id) {
                        btn.classList.add('drag-over');
                    }
                });
                btn.addEventListener('dragleave', () => {
                    btn.classList.remove('drag-over', 'insert-before', 'insert-after');
                });
                btn.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const rect = btn.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const dropAfter = x >= rect.width / 2;
                    
                    btn.classList.remove('drag-over', 'insert-before', 'insert-after');
                    const dataIdStr = e.dataTransfer.getData('text/plain');
                    const draggedId = dataIdStr ? parseInt(dataIdStr, 10) : draggedBlockId;
                    if (draggedId !== null && !isNaN(draggedId) && draggedId !== block.id) {
                        handleBlockDrop(draggedId, block.id, dropAfter);
                    }
                });
            } else {
                btn.style.cursor = 'default';
                btn.style.opacity = '0.5';
            }

            candidatesContainer.appendChild(btn);
        });

        // Update Action Buttons States
        if (!isAnswerSubmitted) {
            clearBtn.disabled = selectedBlocks.length === 0;
            submitBtn.disabled = selectedBlocks.length === 0;
        }
    }

    // 6. Block Movements
    function selectBlock(id) {
        const index = remainingBlocks.findIndex(b => b.id === id);
        if (index > -1) {
            playSfx('click');
            const block = remainingBlocks[index];
            remainingBlocks.splice(index, 1);
            selectedBlocks.push(block);
            renderBlocks();
        }
    }

    // Handle block dropping for reordering and swapping with visual insert support
    function handleBlockDrop(draggedId, targetId, dropAfter = false) {
        if (isAnswerSubmitted) return;
        
        // Find which array draggedId and targetId belong to
        const dragInSelectedIdx = selectedBlocks.findIndex(b => b.id === draggedId);
        const dragInRemainingIdx = remainingBlocks.findIndex(b => b.id === draggedId);
        
        const targetInSelectedIdx = selectedBlocks.findIndex(b => b.id === targetId);
        const targetInRemainingIdx = remainingBlocks.findIndex(b => b.id === targetId);
        
        // Case 1: Reordering within selectedBlocks
        if (dragInSelectedIdx > -1 && targetInSelectedIdx > -1) {
            const block = selectedBlocks[dragInSelectedIdx];
            selectedBlocks.splice(dragInSelectedIdx, 1);
            let newTargetIdx = selectedBlocks.findIndex(b => b.id === targetId);
            if (dropAfter) {
                newTargetIdx += 1;
            }
            selectedBlocks.splice(newTargetIdx, 0, block);
        }
        // Case 2: Dragging from remaining to selected (insert at target index)
        else if (dragInRemainingIdx > -1 && targetInSelectedIdx > -1) {
            const block = remainingBlocks[dragInRemainingIdx];
            remainingBlocks.splice(dragInRemainingIdx, 1);
            let newTargetIdx = selectedBlocks.findIndex(b => b.id === targetId);
            if (dropAfter) {
                newTargetIdx += 1;
            }
            selectedBlocks.splice(newTargetIdx, 0, block);
        }
        // Case 3: Dragging from selected to remaining (insert at target index)
        else if (dragInSelectedIdx > -1 && targetInRemainingIdx > -1) {
            const block = selectedBlocks[dragInSelectedIdx];
            selectedBlocks.splice(dragInSelectedIdx, 1);
            let newTargetIdx = remainingBlocks.findIndex(b => b.id === targetId);
            if (dropAfter) {
                newTargetIdx += 1;
            }
            remainingBlocks.splice(newTargetIdx, 0, block);
        }
        // Case 4: Reordering within remainingBlocks
        else if (dragInRemainingIdx > -1 && targetInRemainingIdx > -1) {
            const block = remainingBlocks[dragInRemainingIdx];
            remainingBlocks.splice(dragInRemainingIdx, 1);
            let newTargetIdx = remainingBlocks.findIndex(b => b.id === targetId);
            if (dropAfter) {
                newTargetIdx += 1;
            }
            remainingBlocks.splice(newTargetIdx, 0, block);
        }
        
        renderBlocks();
    }

    function deselectBlock(id) {
        const index = selectedBlocks.findIndex(b => b.id === id);
        if (index > -1) {
            playSfx('click');
            const block = selectedBlocks[index];
            selectedBlocks.splice(index, 1);
            remainingBlocks.push(block);
            renderBlocks();
        }
    }

    function clearSelection() {
        if (isAnswerSubmitted) return;
        remainingBlocks = [...remainingBlocks, ...selectedBlocks].sort((a, b) => a.id - b.id);
        selectedBlocks = [];
        renderBlocks();
    }

    // 7. Toggle Hint
    function toggleHint() {
        if (hintText.classList.contains('hidden')) {
            hintText.classList.remove('hidden');
            hintBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> 隱藏中文翻譯提示';
            hintBtn.classList.remove('btn-primary');
            hintBtn.classList.add('btn-secondary');
        } else {
            hintText.classList.add('hidden');
            hintBtn.innerHTML = '<i class="fa-regular fa-lightbulb"></i> 顯示中文翻譯提示';
            hintBtn.classList.remove('btn-secondary');
            hintBtn.classList.add('btn-primary');
        }
    }

    // 8. Submit & Evaluate Answer
    function submitAnswer() {
        if (isAnswerSubmitted || selectedBlocks.length === 0) return;
        
        isAnswerSubmitted = true;
        gameAudio.pause();
        helpBgBtn.disabled = true;

        const q = questions[currentQuestionIndex];
        
        // Calculate time spent on this question
        const now = new Date();
        const timeSpent = Math.round((now - questionStartTime) / 1000);
        totalElapsedSeconds += timeSpent;

        // Build User Sequence
        const userSequenceText = selectedBlocks.map(b => b.text);
        
        // Evaluate against Hakka characters
        const currentCorrectHakkaSequence = getHakkaCharacters(q.hakka_hanji);
        const isCorrect = checkSequenceMatch(userSequenceText, currentCorrectHakkaSequence);

        // Disable standard game controls
        submitBtn.classList.add('hidden');
        clearBtn.disabled = true;

        if (isCorrect) {
            playSfx('next');
            correctCount++;
            totalScore += questionScore;
            scoreDisplay.textContent = `得分: ${totalScore}`;
            
            // Bridge cross animation
            isBridgeTransparent = false;
            isBridgeBroken = false;
            dogState = 'crossing';
            shouldAutoTransition = true;
        } else {
            playSfx('wrong');
            // Deduct score for wrong attempt
            questionScore = Math.max(0, questionScore - 2);
            
            // Calculate where the wrong bridge breaks
            const charCount = selectedBlocks.length;
            const correctHakkaSequence = getHakkaCharacters(q.hakka_hanji);
            const totalChars = correctHakkaSequence.length || 1;
            const userBridgeWidth = (charCount / totalChars) * cliffWidth;
            
            if (charCount < totalChars) {
                // If they didn't place all blocks, they fall off the end of their blocks
                wrongBreakX = cliffX + userBridgeWidth;
            } else {
                // If they placed all blocks but wrong order, fall from the broken bridge edge.
                const bridgeSourceWidth = isImageReady(runnerAssets.bridge) ? runnerAssets.bridge.naturalWidth : 805;
                const brokenBridgeSourceWidth = isImageReady(runnerAssets.brokenBridge) ? runnerAssets.brokenBridge.naturalWidth : bridgeSourceWidth / 2;
                const brokenBridgeWidth = (cliffWidth + 4) * (brokenBridgeSourceWidth / bridgeSourceWidth);
                wrongBreakX = cliffX - 2 + brokenBridgeWidth;
            }
            
            // Dog starts running towards the break point
            isBridgeBroken = true;
            dogState = 'crossing';
        }
    }

    let inlineFeedbackTimeout = null;

    function showInlineFeedback(text, color) {
        const inlineMsg = document.getElementById('inline-feedback-msg');
        if (!inlineMsg || !hintText) return;

        const isHintOpen = !hintText.classList.contains('hidden');
        const targetMsg = isHintOpen ? hintText : inlineMsg;
        const normalHintText = getChineseSentenceWithPunctuation(questions[currentQuestionIndex]);
        
        inlineMsg.classList.add('hidden');
        hintText.textContent = isHintOpen ? text : normalHintText;
        hintText.style.color = isHintOpen ? color : '';

        targetMsg.textContent = text;
        targetMsg.style.color = color;
        targetMsg.classList.remove('hidden');
        
        // Clear any existing timeout
        if (inlineFeedbackTimeout) {
            clearTimeout(inlineFeedbackTimeout);
        }
        
        // Hide after 2 seconds for normal wrong answers
        if (text.includes("答錯了")) {
            inlineFeedbackTimeout = setTimeout(() => {
                targetMsg.classList.add('hidden');
                if (isHintOpen) {
                    hintText.textContent = normalHintText;
                    hintText.style.color = '';
                    hintText.classList.remove('hidden');
                }
            }, 2000);
        }
    }

    // Skip Mechanism (求助伯公)
    function askPoKongForHelp() {
        if (isAnswerSubmitted) return;
        
        isAnswerSubmitted = true;
        gameAudio.pause();
        helpBgBtn.disabled = true;
        
        // This question score is 0
        questionScore = 0;
        
        // Transparent bridge appears
        isBridgeTransparent = true;
        isBridgeBroken = false;
        bridgeAlpha = 0.8;
        dogState = 'crossing';
        shouldAutoTransition = true;
        
        // Hide buttons
        submitBtn.classList.add('hidden');
        clearBtn.disabled = true;
    }

    // Dynamic Fade Out Transition & Question Load
    function startFadeOutAndTransition() {
        if (isTransitioning) return;
        isTransitioning = true;
        
        const fadeDuration = 500 / speedMultiplier;
        
        // Set CSS variable
        gameCard.style.setProperty('--fade-duration', `${fadeDuration}ms`);
        gameCard.classList.add('fade-out');
        
        setTimeout(() => {
            currentQuestionIndex++;
            loadQuestion(currentQuestionIndex);
            
            if (currentQuestionIndex < questions.length) {
                dogX = -100;
                dogState = 'transition_in';
            }
            
            setTimeout(() => {
                gameCard.classList.remove('fade-out');
                isTransitioning = false;
            }, 50 / speedMultiplier);
        }, fadeDuration);
    }

    // Check if arrays are equal
    function checkSequenceMatch(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
    }

    // 9. Next Question
    function nextQuestion() {
        // Start transition out (camera pans fast, dog runs off right)
        dogState = 'transition_out';
        feedbackPanel.classList.add('hidden');
    }

    // 10. Show Results
    function showResults() {
        gameCard.classList.add('hidden');
        resultsCard.classList.remove('hidden');

        // Calculate time spent
        const now = new Date();
        const elapsed = Math.round((now - gameStartTime) / 1000);
        
        const accuracy = Math.round((correctCount / questions.length) * 100);

        resultScore.textContent = `${totalScore} 分`;
        resultAccuracy.textContent = `${accuracy}%`;
        resultTime.textContent = `${elapsed} 秒`;

        // Update title badge based on score
        const resultsParagraph = resultsCard.querySelector('p');
        let titleBadge = "探路犬";
        if (totalScore >= 100) titleBadge = "庄頭傳音神犬 🏆";
        else if (totalScore >= 80) titleBadge = "伯公的得力金耳 🐕";
        else if (totalScore >= 60) titleBadge = "聲音收集犬 🦴";
        else if (totalScore >= 40) titleBadge = "迷糊的小神犬 🐾";
        
        resultsParagraph.innerHTML = `修煉完成！獲得稱號：<strong>${titleBadge}</strong><br>感謝你參與「阿黑的客字繪卷」客語聽力挑戰。`;

        // Generate review list of questions
        const reviewList = document.getElementById('review-list');
        reviewList.innerHTML = '';
        
        questions.forEach((q, idx) => {
            const item = document.createElement('div');
            item.className = 'review-item';
            
            const info = document.createElement('div');
            info.className = 'review-info';
            
            const hakka = document.createElement('span');
            hakka.className = 'review-hakka';
            hakka.textContent = `第 ${idx + 1} 題：${q.hakka_hanji}`;
            
            const translation = document.createElement('span');
            translation.className = 'review-translation';
            translation.textContent = `翻譯：${getChineseSentenceWithPunctuation(q)}`;
            
            info.appendChild(hakka);
            info.appendChild(translation);
            
            const playBtn = document.createElement('button');
            playBtn.className = 'review-play-btn';
            playBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            playBtn.title = '播放音檔';
            
            playBtn.addEventListener('click', () => {
                // Play this question's audio
                const reviewAudio = new Audio(q.audio_url);
                reviewAudio.play().catch(err => {
                    console.error("播放音檔失敗:", err);
                });
            });
            
            item.appendChild(info);
            item.appendChild(playBtn);
            reviewList.appendChild(item);
        });
    }

    // Audio Event Handlers
    function toggleAudio() {
        if (gameAudio.paused) {
            gameAudio.play().catch(e => {
                console.error("播放音檔失敗:", e);
            });
        } else {
            gameAudio.pause();
        }
    }

    function onAudioPlay() {
        playAudioBtn.classList.add('playing');
        playAudioBtn.querySelector('.play-icon').classList.add('hidden');
        playAudioBtn.querySelector('.pause-icon').classList.remove('hidden');
        soundwave.classList.remove('hidden');
    }

    function onAudioPause() {
        playAudioBtn.classList.remove('playing');
        playAudioBtn.querySelector('.play-icon').classList.remove('hidden');
        playAudioBtn.querySelector('.pause-icon').classList.add('hidden');
    }

    function onAudioEnded() {
        onAudioPause();
    }

    // ---------------------------------------------------------
    // 2D Canvas Engine Support Functions
    // ---------------------------------------------------------
    function setupCanvasEngine() {
        ctx.imageSmoothingEnabled = false;

        // Start animation frame loop
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        
        function loop() {
            updateGamePhysics();
            drawGameGraphics();
            animationFrameId = requestAnimationFrame(loop);
        }
        
        loop();
    }

    function resetCanvasForQuestion(q) {
        hasCliffAppeared = false;
        cliffX = 1160; // Place cliff completely off-screen to the right (continuous loop)
        if (dogState !== 'transition_in') {
            dogState = 'running';
        }
        isBridgeTransparent = false;
        isBridgeBroken = false;
        bridgeAlpha = 0.0;
        splashParticles = [];
        sparkles = [];
        wrongBreakX = null;
        
        // Dynamically compute speed based on audio duration (Section IV formula)
        // Set L = 930 px (1160 - 230). Time duration is D seconds.
        // We calculate base speed at 1x so the cliff arrives exactly when the audio finishes.
        gameAudio.addEventListener('loadedmetadata', function durationListener() {
            const D = gameAudio.duration || 3.0; // fallback if metadata not loaded
            questionBaseSpeed = Math.max(1.0, 930 / (D * 60));
            activeSpeed = questionBaseSpeed * speedMultiplier;
            gameAudio.removeEventListener('loadedmetadata', durationListener);
        });
        
        // If metadata is already loaded:
        if (gameAudio.duration) {
            const D = gameAudio.duration;
            questionBaseSpeed = Math.max(1.0, 930 / (D * 60));
            activeSpeed = questionBaseSpeed * speedMultiplier;
        }
    }

    function updateGamePhysics() {
        if (isGamePaused) return;
        
        dogFrame++;
        
        // Decrement flash timer
        if (flashTimer > 0) {
            flashTimer--;
        }
        
        // Update transparent bridge alpha pulsations
        if (isBridgeTransparent) {
            bridgeAlpha = 0.6 + Math.sin(dogFrame * 0.15) * 0.2;
        }
        
        // Handle physical movement based on dogState
        if (dogState === 'running') {
            // Move cliff closer and scroll background layers ONLY before cliff appears
            if (!hasCliffAppeared) {
                scrollX += activeSpeed;
                skyScrollX += activeSpeed * 0.05;
                mountainScrollX += activeSpeed * 0.15;
                forestScrollX += activeSpeed * 0.4;
                
                cliffX -= activeSpeed;
                if (cliffX <= cliffTargetX) {
                    cliffX = cliffTargetX;
                    hasCliffAppeared = true;
                }
            }
            
            // Ensure dog is in running position
            dogX += (180 - dogX) * 0.1;
            dogY = groundY;
        } 
        else if (dogState === 'transition_out') {
            // Scroll background and ground very fast (camera pan effect)
            const transitionSpeed = 10 * speedMultiplier;
            scrollX += transitionSpeed;
            skyScrollX += transitionSpeed * 0.05;
            mountainScrollX += transitionSpeed * 0.15;
            forestScrollX += transitionSpeed * 0.4;
            
            // Move dog forward off-screen
            dogX += transitionSpeed * 1.2;
            dogY = groundY;
            
            // If dog is fully off-screen, load the next question
            if (dogX >= canvasWidth + 100) {
                currentQuestionIndex++;
                loadQuestion(currentQuestionIndex);
                
                // If it's not the end of the game, prepare transition_in
                if (currentQuestionIndex < questions.length) {
                    dogX = -100;
                    dogState = 'transition_in';
                }
            }
        }
        else if (dogState === 'transition_in') {
            // Normal scroll
            scrollX += activeSpeed;
            skyScrollX += activeSpeed * 0.05;
            mountainScrollX += activeSpeed * 0.15;
            forestScrollX += activeSpeed * 0.4;
            
            // Move cliff closer
            if (!hasCliffAppeared) {
                cliffX -= activeSpeed;
                if (cliffX <= cliffTargetX) {
                    cliffX = cliffTargetX;
                    hasCliffAppeared = true;
                }
            }
            
            // Dog runs in from left to 180
            dogX += (180 - dogX) * 0.1;
            dogY = groundY;
            
            // If dog reaches running position, change state to running
            if (dogX >= 175) {
                dogX = 180;
                dogState = 'running';
            }
        } 
        else if (dogState === 'crossing') {
            // Dog runs across the bridge
            dogX += activeSpeed * 1.5;
            
            // Sparkle effects on the bridge
            if (dogFrame % 6 === 0) {
                sparkles.push({
                    x: dogX - 10,
                    y: groundY - 5 + Math.random() * 10,
                    size: 2 + Math.random() * 3,
                    alpha: 1.0,
                    color: isBridgeTransparent ? 'var(--accent)' : 'var(--primary-light)'
                });
            }
            
            // Check if dog reached the wrong break point
            if (wrongBreakX !== null && dogX >= wrongBreakX) {
                dogState = 'falling';
                wrongBreakX = null; // Clear to prevent double trigger
                
                // Trigger the falling and splash timeout to show feedback
                setTimeout(() => {
                    const q = questions[currentQuestionIndex];
                    if (questionScore <= 0) {
                        // Auto-pass: failed 5 times (or score reaches 0)
                        showInlineFeedback("嘗試失敗次數過多，伯公顯聖為你架起橋梁！", 'var(--accent)');
                        
                        // 1. Fade out the card
                        const fadeOutDuration = 250 / speedMultiplier;
                        gameCard.style.setProperty('--fade-duration', `${fadeOutDuration}ms`);
                        gameCard.classList.add('fade-out');
                        
                        setTimeout(() => {
                            // 2. Put the dog back in the sky above starting point (to drop and flash)
                            dogX = 180;
                            dogY = -100;
                            dogState = 'recovering';
                            flashTimer = 25;
                            
                            // 3. Make transparent bridge appear
                            isBridgeTransparent = true;
                            isBridgeBroken = false;
                            bridgeAlpha = 0.8;
                            
                            // 4. Fade back in
                            gameCard.classList.remove('fade-out');
                            
                            // 5. Let the dog cross the bridge after a longer delay (2 seconds waiting time)
                            setTimeout(() => {
                                dogState = 'crossing';
                                shouldAutoTransition = true;
                            }, 2400 / speedMultiplier);
                        }, fadeOutDuration);
                    } else {
                        // Normal incorrect retry
                        showInlineFeedback("答錯了！字卡已還原請重新排列！", 'var(--danger)');
                        
                        dogState = 'recovering';
                        dogX = 180;
                        dogY = -100;
                        flashTimer = 25; // Flash 2 times (25 frames)
                        isAnswerSubmitted = false;
                        isBridgeBroken = false;
                        
                        clearSelection();
                        submitBtn.classList.remove('hidden');
                        submitBtn.disabled = true;
                        clearBtn.disabled = true;
                        helpBgBtn.disabled = false;
                    }
                }, 1200);
            }
            // Otherwise, check if dog reached the other side (only if not falling)
            else if (wrongBreakX === null && dogX >= cliffX + cliffWidth + 12) {
                // Successfully crossed! Transition to running on the other side or start fade out
                if (shouldAutoTransition) {
                    startFadeOutAndTransition();
                } else {
                    dogState = 'running';
                    
                    // Reset cliff position and scroll background out to load the next question
                    hasCliffAppeared = false;
                    
                    // Triggers next question automatically if skipped via help
                    if (isBridgeTransparent) {
                        isBridgeTransparent = false;
                    }
                    isBridgeBroken = false;
                }
            }
        } 
        else if (dogState === 'falling') {
            // Dog falls off the cliff into the river
            dogX += activeSpeed * 0.5;
            dogY += 6.5; // gravity pull
            
            if (dogY >= riverY) {
                dogY = riverY;
                dogState = 'splashing';
                playSfx('splash');
                createSplash(dogX, riverY);
            }
        } 
        else if (dogState === 'splashing') {
            // Splash particles updating
            updateSplash();
        } 
        else if (dogState === 'recovering') {
            // Dog falls down from the sky vertically to groundY
            dogX = 180;
            dogY += (groundY - dogY) * 0.15;
            
            if (Math.abs(dogY - groundY) < 1) {
                dogY = groundY;
                dogState = 'running';
            }
        }
    }

    function drawGameGraphics() {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        // 1. Draw Sky
        let grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
        grad.addColorStop(0, '#8bdff1'); 
        grad.addColorStop(0.68, '#dff8e4'); 
        grad.addColorStop(1, '#d8f4ff'); 
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        const grassDrawn = drawScrollingImage(runnerAssets.grass, 96, 52, forestScrollX, 0.8, 1);
        if (!grassDrawn) {
            ctx.fillStyle = '#78b85a';
            ctx.fillRect(0, groundY - 12, canvasWidth, 16);
        }

        const mountainsDrawn = drawScrollingImage(runnerAssets.mountains, 18, 92, mountainScrollX, 0.45);
        if (!mountainsDrawn) {
            ctx.fillStyle = '#8fbf73';
            ctx.beginPath();
            for (let i = 0; i <= canvasWidth; i += 20) {
                let relativeScroll = (mountainScrollX + i) % (canvasWidth * 1.5);
                let y = groundY - 45 + Math.sin(relativeScroll * 0.004) * 25 + Math.cos(relativeScroll * 0.008) * 10;
                if (i === 0) ctx.moveTo(i, y);
                else ctx.lineTo(i, y);
            }
            ctx.lineTo(canvasWidth, groundY);
            ctx.lineTo(0, groundY);
            ctx.fill();
        }

        const villageDrawn = drawScrollingImage(runnerAssets.village, 48, 88, forestScrollX, 0.65);
        if (!villageDrawn) {
            ctx.fillStyle = '#71a858';
            ctx.beginPath();
            for (let i = 0; i <= canvasWidth; i += 15) {
                let relativeScroll = (forestScrollX + i) % (canvasWidth * 1.5);
                let y = groundY - 15 + Math.sin(relativeScroll * 0.008) * 12;
                if (i === 0) ctx.moveTo(i, y);
                else ctx.lineTo(i, y);
            }
            ctx.lineTo(canvasWidth, groundY);
            ctx.lineTo(0, groundY);
            ctx.fill();
        }

        // 4. Draw River bed
        ctx.fillStyle = '#dee0a3';
        ctx.fillRect(0, groundY, canvasWidth, canvasHeight - groundY);
        
        // Draw wavy river water
        ctx.fillStyle = '#6daaf1';
        ctx.beginPath();
        for (let i = 0; i <= canvasWidth; i += 25) {
            let relativeScroll = (scrollX + i) % (canvasWidth * 1.5);
            let y = riverY + Math.sin(relativeScroll * 0.03 + dogFrame * 0.08) * 6;
            if (i === 0) ctx.moveTo(i, y);
            else ctx.lineTo(i, y);
        }
        ctx.lineTo(canvasWidth, canvasHeight);
        ctx.lineTo(0, canvasHeight);
        ctx.fill();
        
        // 5. Draw flat image ground.
        const groundTop = groundY - 8;
        const groundHeight = canvasHeight - groundTop + 8;
        const cliffInnerOverlap = 18;
        const groundJoinOverlap = 1;
        const cliffYOffset = 0;
        const leftCliffImage = runnerAssets.floorRight;
        const rightCliffImage = runnerAssets.floorLeft;
        const cliffHeight = groundHeight;
        const leftCliffWidth = isImageReady(leftCliffImage)
            ? leftCliffImage.naturalWidth * (cliffHeight / leftCliffImage.naturalHeight)
            : 0;
        const rightCliffWidth = isImageReady(rightCliffImage)
            ? rightCliffImage.naturalWidth * (cliffHeight / rightCliffImage.naturalHeight)
            : 0;
        const cliffDrawTop = groundTop + cliffYOffset;
        const leftCliffX = cliffX - leftCliffWidth + cliffInnerOverlap;
        const rightCliffX = (cliffX + cliffWidth) - cliffInnerOverlap;
        const leftGroundEndX = leftCliffX + groundJoinOverlap;
        const rightGroundStartX = rightCliffX + rightCliffWidth - groundJoinOverlap;

        if (hasCliffAppeared || cliffX < canvasWidth) {
            // Left platform
            if (cliffX > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, groundTop, Math.max(0, leftGroundEndX), groundHeight);
                ctx.clip();
                if (!drawScrollingImage(runnerAssets.floorLoop, groundTop, groundHeight, scrollX, 1, 6)) {
                    ctx.fillStyle = '#c97820';
                    ctx.fillRect(0, groundY, cliffX, riverY - groundY - 4);
                    ctx.fillStyle = '#76aa25';
                    ctx.fillRect(0, groundY - 4, cliffX, 10);
                }
                ctx.restore();
            }
            
            // Right platform
            let rightStart = cliffX + cliffWidth;
            if (rightStart < canvasWidth) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(rightGroundStartX, groundTop, Math.max(0, canvasWidth - rightGroundStartX), groundHeight);
                ctx.clip();
                if (!drawScrollingImage(runnerAssets.floorLoop, groundTop, groundHeight, scrollX, 1, 6)) {
                    ctx.fillStyle = '#c97820';
                    ctx.fillRect(rightStart, groundY, canvasWidth - rightStart, riverY - groundY - 4);
                    ctx.fillStyle = '#76aa25';
                    ctx.fillRect(rightStart, groundY - 4, canvasWidth - rightStart, 10);
                }
                ctx.restore();
            }
            
            if (leftCliffWidth > 0) {
                drawImageByHeight(leftCliffImage, leftCliffX, cliffDrawTop, cliffHeight);
            }
            if (rightCliffWidth > 0) {
                drawImageByHeight(rightCliffImage, rightCliffX, cliffDrawTop, cliffHeight);
            }
        } else {
            // Normal solid ground
            if (!drawScrollingImage(runnerAssets.floorLoop, groundTop, groundHeight, scrollX, 1, 6)) {
                ctx.fillStyle = '#c97820';
                ctx.fillRect(0, groundY, canvasWidth, riverY - groundY - 4);
                ctx.fillStyle = '#76aa25';
                ctx.fillRect(0, groundY - 4, canvasWidth, 10);
            }
        }
        
        // 6. Draw Bridge
        drawBridge();
        
        // 7. Draw Sparkles & particles
        drawSparkles();
        drawSplashParticles();
        
        // 8. Draw Dog (阿黑)
        drawDog(dogX, dogY, dogState, dogFrame);
    }

    // Animated Dog Drawing Function
    function drawDog(x, y, state, frame) {
        if (state === 'splashing') return;

        ctx.save();
        
        // Apply flashing effect if active
        if (flashTimer > 0) {
            if (Math.floor(flashTimer / 5) % 2 === 0) {
                ctx.globalAlpha = 0.2;
            }
        }

        if (isImageReady(runnerAssets.kuroRun) && state !== 'splashing') {
            const dogScale = 0.65;
            const dogWidth = 86 * dogScale;
            const dogHeight = 62 * dogScale;
            const runBob = (state === 'running' || state === 'crossing' || state === 'transition_out' || state === 'transition_in')
                ? Math.sin(frame * 0.22) * 2
                : 0;

            ctx.translate(x, y + runBob);

            if (state === 'falling') {
                ctx.translate(0, -10);
                ctx.rotate(frame * 0.1);
            }

            ctx.drawImage(runnerAssets.kuroRun, -31, -dogHeight + 5, dogWidth, dogHeight);
            ctx.restore();
            return;
        }
        
        ctx.translate(x, y);
        
        if (state === 'falling') {
            ctx.translate(0, -10);
            ctx.rotate(frame * 0.1);
        }
        
        const furColor = '#1a1a1a'; 
        const bellyColor = '#333333'; 
        const earColor = '#111111';
        const noseColor = '#6b4d35'; 
        const tongueColor = '#ff6b6b';
        
        let frontLegAngle = 0;
        let backLegAngle = 0;
        
        if (state === 'running' || state === 'transition_out' || state === 'transition_in') {
            frontLegAngle = Math.sin(frame * 0.18) * 0.65;
            backLegAngle = -Math.sin(frame * 0.18) * 0.65;
        } else if (state === 'crossing') {
            frontLegAngle = Math.sin(frame * 0.28) * 0.75;
            backLegAngle = -Math.sin(frame * 0.28) * 0.75;
        } else if (state === 'falling') {
            frontLegAngle = 0.9;
            backLegAngle = -0.9;
        } else if (state === 'recovering') {
            frontLegAngle = Math.sin(frame * 0.22) * 0.4;
            backLegAngle = -Math.sin(frame * 0.22) * 0.4;
        }
        
        if (state !== 'splashing') {
            // Draw Tail
            ctx.save();
            ctx.translate(-20, -16);
            let tailWag = Math.sin(frame * 0.25) * 0.25;
            if (state === 'crossing' || state === 'transition_out') tailWag = Math.sin(frame * 0.5) * 0.4;
            ctx.rotate(-0.6 + tailWag);
            ctx.fillStyle = furColor;
            ctx.beginPath();
            ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            // Draw Back Legs (drawn behind)
            drawLeg(-12, -2, backLegAngle, furColor);
            drawLeg(10, -2, frontLegAngle, furColor);
            
            // Draw Body
            ctx.fillStyle = furColor;
            ctx.beginPath();
            ctx.ellipse(0, -12, 22, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Belly patch
            ctx.fillStyle = bellyColor;
            ctx.beginPath();
            ctx.ellipse(1, -9, 13, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw Front Legs (drawn in front)
            drawLeg(-10, -2, -backLegAngle, furColor);
            drawLeg(12, -2, -frontLegAngle, furColor);
            
            // Draw Neck
            ctx.fillStyle = furColor;
            ctx.save();
            ctx.translate(14, -20);
            ctx.rotate(0.3);
            ctx.beginPath();
            ctx.ellipse(0, 0, 8, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            // Draw Head
            ctx.save();
            ctx.translate(22, -26);
            ctx.fillStyle = furColor;
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
            
            // Snout
            ctx.fillStyle = furColor;
            ctx.beginPath();
            ctx.ellipse(8, 2, 6, 4, 0.1, 0, Math.PI * 2);
            ctx.fill();
            
            // Nose tip
            ctx.fillStyle = noseColor;
            ctx.beginPath();
            ctx.arc(13, 1, 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Eye
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(4, -3, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(5, -3, 1.2, 0, Math.PI * 2);
            ctx.fill();
            
            // Ear
            ctx.save();
            ctx.translate(-4, -6);
            let earFlap = Math.sin(frame * 0.12) * 0.15;
            if (state === 'running' || state === 'crossing' || state === 'transition_out' || state === 'transition_in') earFlap = Math.sin(frame * 0.3) * 0.25;
            ctx.rotate(0.6 + earFlap);
            ctx.fillStyle = earColor;
            ctx.beginPath();
            ctx.ellipse(0, 0, 4, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            // Tongue
            if (state === 'running' || state === 'crossing' || state === 'transition_out' || state === 'transition_in') {
                ctx.fillStyle = tongueColor;
                ctx.beginPath();
                ctx.ellipse(8, 6, 3.2, 2.2, 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
        } else {
            // Splashing drowning state
            ctx.save();
            ctx.translate(0, 6);
            ctx.fillStyle = furColor;
            ctx.beginPath();
            ctx.arc(0, -10, 9, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = 'white';
            ctx.font = 'bold 9px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('X', -3, -10);
            ctx.fillText('X', 3, -10);
            
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, -6, 12, Math.PI, 0);
            ctx.stroke();
            ctx.restore();
        }
        
        ctx.restore();
    }
    
    function drawLeg(offsetX, offsetY, angle, color) {
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 5, 3.5, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(0, 11, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawBridge() {
        if (isAnswerSubmitted && dogState !== 'recovering') {
            ctx.save();
            
            if (isBridgeTransparent) {
                // Glow Transparent bridge (Ask Po Kong for help)
                ctx.lineWidth = 6;
                ctx.strokeStyle = `rgba(255, 183, 3, ${bridgeAlpha})`;
                ctx.shadowColor = 'var(--accent)';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.moveTo(cliffX, groundY + 4);
                ctx.lineTo(cliffX + cliffWidth, groundY + 4);
                ctx.stroke();
                
                // Draw glass transparent deck
                ctx.fillStyle = `rgba(255, 255, 255, ${bridgeAlpha * 0.15})`;
                ctx.fillRect(cliffX, groundY + 4, cliffWidth, 10);
            } else {
                // Solid wood plank bridge (No text)
                const charCount = selectedBlocks.length;
                if (charCount > 0) {
                    const q = questions[currentQuestionIndex];
                    const correctHakkaSequence = getHakkaCharacters(q.hakka_hanji);
                    const totalChars = correctHakkaSequence.length || 1;
                    const blockWidth = cliffWidth / totalChars;

                    if (isBridgeBroken && isImageReady(runnerAssets.brokenBridge) && isImageReady(runnerAssets.bridge)) {
                        const bridgeHeight = 22;
                        const bridgeWidth = cliffWidth + 4;
                        const bridgeScale = bridgeWidth / runnerAssets.bridge.naturalWidth;
                        const brokenBridgeWidth = runnerAssets.brokenBridge.naturalWidth * bridgeScale;
                        ctx.drawImage(runnerAssets.brokenBridge, cliffX - 2, groundY - 2, brokenBridgeWidth, bridgeHeight);
                    } else if (isImageReady(runnerAssets.bridge)) {
                        ctx.drawImage(runnerAssets.bridge, cliffX - 2, groundY - 2, cliffWidth + 4, 22);
                    } else {
                        selectedBlocks.forEach((block, idx) => {
                            let bx = cliffX + idx * blockWidth;
                            let by = groundY + 2;
                            
                            // Solid wooden plank styling
                            ctx.fillStyle = '#8B5A2B'; // Solid wood brown
                            ctx.strokeStyle = '#5c3a1a'; // Darker brown border
                            ctx.lineWidth = 2;
                            
                            ctx.beginPath();
                            ctx.roundRect(bx + 1, by, blockWidth - 2, 12, 3);
                            ctx.fill();
                            ctx.stroke();
                            
                            // Subtle wooden grain lines
                            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            ctx.moveTo(bx + 3, by + 4);
                            ctx.lineTo(bx + blockWidth - 5, by + 4);
                            ctx.moveTo(bx + 5, by + 8);
                            ctx.lineTo(bx + blockWidth - 7, by + 8);
                            ctx.stroke();
                        });
                    }
                }
            }
            
            ctx.restore();
        }
    }

    // Sparkle Particle systems
    function drawSparkles() {
        ctx.save();
        for (let i = sparkles.length - 1; i >= 0; i--) {
            let p = sparkles[i];
            p.y -= 0.5;
            p.alpha -= 0.02;
            
            if (p.alpha <= 0) {
                sparkles.splice(i, 1);
                continue;
            }
            
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.restore();
    }

    // Splash Particles systems
    function createSplash(x, y) {
        splashParticles = [];
        for (let i = 0; i < 20; i++) {
            splashParticles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 6,
                vy: -Math.random() * 8 - 4,
                size: 2 + Math.random() * 5,
                color: '#8ecae6',
                alpha: 1.0
            });
        }
    }

    function updateSplash() {
        for (let i = splashParticles.length - 1; i >= 0; i--) {
            let p = splashParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.45; // gravity
            p.alpha -= 0.025;
            
            if (p.alpha <= 0) {
                splashParticles.splice(i, 1);
            }
        }
    }

    function drawSplashParticles() {
        ctx.save();
        for (let i = 0; i < splashParticles.length; i++) {
            let p = splashParticles[i];
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // ---------------------------------------------------------
    // Execution Entry Point
    // ---------------------------------------------------------
    init();
});

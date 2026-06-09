document.addEventListener('DOMContentLoaded', function() {
    const dateInput = document.querySelector('.date-picker-input');
    const calendar = document.querySelector('.date-picker-calendar');
    const calendarDays = document.querySelector('.calendar-days');
    const calendarTitle = document.querySelector('.calendar-title');
    const prevMonthBtn = document.querySelector('.prev-month');
    const nextMonthBtn = document.querySelector('.next-month');
    const generateBtn = document.getElementById('generate');
    const fillBtn = document.getElementById('fillBilibili');
    const fillStatus = document.getElementById('fillStatus');
    const detectBtn = document.getElementById('detectCurrentPage');
    const detectStatus = document.getElementById('detectStatus');
    const sourceBanner = document.getElementById('sourceBanner');
    const sourceChip = document.getElementById('sourceChip');
    const titlePreview = document.getElementById('result');
    const successMessage = document.querySelector('.success-message');
    const shortcutButtons = document.querySelectorAll('.shortcut-button');
    const trainerButtonsContainer = document.getElementById('trainerButtons');
    let trainerButtons = [];
    const showChenToggle = document.getElementById('showChenToggle');
    const aerobicButtons = document.querySelectorAll('.aerobic-button');
    const timeButtons = document.querySelectorAll('.time-button');
    const timeGroup = document.getElementById('timeGroup');
    const aerobicGroup = document.getElementById('aerobicGroup');

    let currentDate = new Date();
    let selectedDate = new Date();

    let showChen = false;

    let selectedTrainer = '祖嘉泽';
    let selectedAerobic = '手臂核心';
    let selectedTime = '晚间';
    let titleSource = 'default';
    let activeFillRunId = null;
    let fillProgressItems = [];

    const DETECT_MESSAGE_TYPE = 'GET_UPLOAD_TITLE_CANDIDATES';
    const FILL_MESSAGE_TYPE = 'FILL_UPLOAD_FORM';
    const FILL_PROGRESS_MESSAGE_TYPE = 'FILL_UPLOAD_PROGRESS';
    const DEFAULT_FILL_CONFIG = {
        declaration: '内容无需标注',
        category: '健身',
        tags: ['减肥', '健身', '训练']
    };
    const COVER_CONFIG_BY_TRAINER = {
        '祖嘉泽': {
            path: 'covers/zu-jiaze.jpg',
            filename: 'zu-jiaze.jpg'
        },
        '陈玉轩': {
            path: 'covers/chen-yuxuan.jpg',
            filename: 'chen-yuxuan.jpg'
        },
        '张峰': {
            path: 'covers/zhang-feng.png',
            filename: 'zhang-feng.png'
        }
    };

    function setTitleSource(source, detail) {
        titleSource = source;
        if (sourceChip) {
            sourceChip.classList.remove('source-chip-default', 'source-chip-detected', 'source-chip-manual');
            if (source === 'detected') {
                sourceChip.textContent = '已识别';
                sourceChip.classList.add('source-chip-detected');
            } else if (source === 'manual') {
                sourceChip.textContent = '手动';
                sourceChip.classList.add('source-chip-manual');
            } else {
                sourceChip.textContent = '未识别';
                sourceChip.classList.add('source-chip-default');
            }
        }

        if (!sourceBanner) {
            return;
        }

        sourceBanner.classList.remove('source-default', 'source-detected', 'source-manual');

        if (source === 'detected') {
            sourceBanner.textContent = detail || '已识别投稿页，请确认后填写';
            sourceBanner.classList.add('source-detected');
            return;
        }

        if (source === 'manual') {
            sourceBanner.textContent = detail || '已手动调整，将按当前选择填写';
            sourceBanner.classList.add('source-manual');
            return;
        }

        sourceBanner.textContent = detail || '未识别，当前为默认日期';
        sourceBanner.classList.add('source-default');
    }

    function markManualAdjustment(detail) {
        if (titleSource === 'detected' || titleSource === 'default') {
            setTitleSource('manual', detail);
        }
    }

    function getTrainers() {
        return [
            { name: '祖嘉泽', enabled: true },
            { name: '陈玉轩', enabled: showChen },
            { name: '张峰', enabled: true }
        ];
    }

    function renderTrainerButtons() {
        trainerButtonsContainer.innerHTML = '';
        const trainers = getTrainers().filter(trainer => trainer.enabled);
        if (!trainers.some(trainer => trainer.name === selectedTrainer)) {
            selectedTrainer = trainers[0]?.name || selectedTrainer;
        }
        trainers.forEach((trainer) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'trainer-button';
            button.dataset.trainer = trainer.name;
            button.textContent = trainer.name;
            if (trainer.name === selectedTrainer) {
                button.classList.add('active');
            }
            trainerButtonsContainer.appendChild(button);
        });
        trainerButtons = trainerButtonsContainer.querySelectorAll('.trainer-button');
    }

    function syncTimeButtons() {
        timeButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.time === selectedTime);
        });
    }

    function updateShortcutButtons() {
        shortcutButtons.forEach(button => {
            const shortcutDate = new Date();
            shortcutDate.setDate(shortcutDate.getDate() + parseInt(button.dataset.days));
            button.classList.toggle('active', selectedDate && isSameDay(selectedDate, shortcutDate));
        });
    }

    function getTitle() {
        if (!selectedDate) {
            return '';
        }

        const trainer = selectedTrainer;
        const time = selectedTime;
        const weekDay = selectedDate.getDay();
        const dateStr = formatDate(selectedDate);

        if (trainer === '祖嘉泽') {
            return `「${dateStr}｜${time}」祖嘉泽有氧健身 直播回放录屏完整版`;
        }

        if (trainer === '张峰') {
            let trainingType = getTrainingType(trainer, weekDay);
            if (weekDay === 5) {
                trainingType = selectedAerobic;
            }
            return `「${dateStr}｜${trainingType}」张峰-Give Me Five 直播回放录屏完整版`;
        }

        const trainingType = getTrainingType(trainer, weekDay);
        return `「${dateStr}｜晚间｜${trainingType}」陈玉轩-轩誓肌动 直播回放录屏完整版`;
    }

    function refreshPreview() {
        dateInput.value = selectedDate ? formatDate(selectedDate) : '';
        updateShortcutButtons();
        titlePreview.value = getTitle();
    }

    function refreshControls() {
        syncTimeButtons();
        updateAerobicGroup();
        refreshPreview();
    }

    function setDetectStatus(message, type = 'neutral') {
        if (!detectStatus) {
            return;
        }

        detectStatus.textContent = message;
        detectStatus.classList.remove('success', 'error', 'neutral');
        detectStatus.classList.add(type);
    }

    function setDetectSummary(items, type = 'success') {
        if (!detectStatus) {
            return;
        }

        detectStatus.innerHTML = '';
        detectStatus.classList.remove('success', 'error', 'neutral');
        detectStatus.classList.add(type);

        items.forEach((item) => {
            const line = document.createElement('div');
            if (typeof item === 'string') {
                line.textContent = item;
            } else {
                line.textContent = item.text;
                if (item.type) {
                    line.classList.add(item.type);
                }
            }
            detectStatus.appendChild(line);
        });
    }

    function setFillStatus(items, type = 'neutral') {
        if (!fillStatus) {
            return;
        }

        fillStatus.innerHTML = '';
        fillStatus.classList.remove('success', 'error', 'neutral');
        fillStatus.classList.add(type);

        const lines = Array.isArray(items) ? items : [items];
        lines.forEach((item) => {
            const line = document.createElement('div');
            if (typeof item === 'string') {
                line.textContent = item;
            } else {
                line.textContent = item.text;
                if (item.type) {
                    line.classList.add(item.type);
                }
            }
            fillStatus.appendChild(line);
        });
    }

    // 添加博主选择事件监听
    function bindTrainerButtonEvents() {
        trainerButtons.forEach(button => {
            button.addEventListener('click', function() {
                // 移除其他按钮的激活状态
                trainerButtons.forEach(btn => btn.classList.remove('active'));
                // 激活当前按钮
                this.classList.add('active');
                selectedTrainer = this.dataset.trainer;
                markManualAdjustment('已手动调整博主，将按当前选择填写');

                // 根据选择的博主显示/隐藏时间段选择
                if (selectedTrainer === '陈玉轩' || selectedTrainer === '张峰') {
                    selectedTime = '晚间';
                    timeGroup.classList.add('hidden');
                } else {
                    timeGroup.classList.remove('hidden');
                }

                refreshControls();
            });
        });
    }

    // 添加有氧类型选择事件监听
    aerobicButtons.forEach(button => {
        button.addEventListener('click', function() {
            // 移除其他按钮的激活状态
            aerobicButtons.forEach(btn => btn.classList.remove('active'));
            // 激活当前按钮
            this.classList.add('active');
            selectedAerobic = this.dataset.aerobic;
            markManualAdjustment('已手动调整类型，将按当前选择填写');
            refreshPreview();
        });
    });

    // 添加时间段选择事件监听
    timeButtons.forEach(button => {
        button.addEventListener('click', function() {
            // 移除其他按钮的激活状态
            timeButtons.forEach(btn => btn.classList.remove('active'));
            // 激活当前按钮
            this.classList.add('active');
            selectedTime = this.dataset.time;
            markManualAdjustment('已手动调整时间段，将按当前选择填写');
            refreshPreview();
        });
    });

    // 更新有氧选择组的显示状态
    function updateAerobicGroup() {
        if (selectedTrainer === '张峰' && selectedDate && selectedDate.getDay() === 5) {
            aerobicGroup.classList.remove('hidden');
        } else {
            aerobicGroup.classList.add('hidden');
        }
    }

    // 初始化trainer状态
    function updateTrainerUI() {
        if (selectedTrainer === '陈玉轩' || selectedTrainer === '张峰') {
            selectedTime = '晚间';
            timeGroup.classList.add('hidden');
        } else {
            timeGroup.classList.remove('hidden');
        }
        refreshControls();
    }

    function saveShowChenPreference(value) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ showChen: value });
        } else {
            try {
                localStorage.setItem('showChen', value ? '1' : '0');
            } catch (error) {
                // Ignore storage failures.
            }
        }
    }

    function loadShowChenPreference() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get({ showChen: false }, (result) => {
                showChen = Boolean(result.showChen);
                if (showChenToggle) {
                    showChenToggle.checked = showChen;
                }
                renderTrainerButtons();
                bindTrainerButtonEvents();
                updateTrainerUI();
            });
            return;
        }

        try {
            showChen = localStorage.getItem('showChen') === '1';
        } catch (error) {
            showChen = false;
        }

        if (showChenToggle) {
            showChenToggle.checked = showChen;
        }
        renderTrainerButtons();
        bindTrainerButtonEvents();
        updateTrainerUI();
    }

    if (showChenToggle) {
        showChenToggle.addEventListener('change', () => {
            showChen = showChenToggle.checked;
            saveShowChenPreference(showChen);
            renderTrainerButtons();
            bindTrainerButtonEvents();
            updateTrainerUI();
        });
    }

    loadShowChenPreference();

    // 初始化日历
    function initCalendar() {
        dateInput.addEventListener('click', (e) => {
            e.stopPropagation();
            calendar.classList.toggle('calendar-show');
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.date-picker-container')) {
                calendar.classList.remove('calendar-show');
            }
        });

        prevMonthBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        });

        nextMonthBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        });

        renderCalendar();
    }

    // 渲染日历
    function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay();
        const totalDays = lastDay.getDate();

        calendarTitle.textContent = `${year}年${month + 1}月`;
        calendarDays.innerHTML = '';

        // 添加上个月的日期
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startDay - 1; i >= 0; i--) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day other-month';
            dayElement.textContent = prevMonthLastDay - i;
            calendarDays.appendChild(dayElement);
        }

        // 添加当月日期
        for (let day = 1; day <= totalDays; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;

            const currentDateObj = new Date(year, month, day);
            
            // 标记今天
            if (isToday(currentDateObj)) {
                dayElement.classList.add('today');
            }

            // 标记选中日期
            if (selectedDate && isSameDay(currentDateObj, selectedDate)) {
                dayElement.classList.add('selected');
            }

            dayElement.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedDate = currentDateObj;
                markManualAdjustment('已手动调整日期，将按当前选择填写');
                calendar.classList.remove('calendar-show');

                // 移除其他日期的选中状态
                document.querySelectorAll('.calendar-day.selected').forEach(el => {
                    el.classList.remove('selected');
                });

                // 添加当前日期的选中状态
                dayElement.classList.add('selected');

                // 更新有氧选择组显示状态
                refreshControls();
            });

            calendarDays.appendChild(dayElement);
        }

        // 添加下个月的日期
        const remainingDays = 42 - (startDay + totalDays); // 6行7列 = 42
        for (let i = 1; i <= remainingDays; i++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day other-month';
            dayElement.textContent = i;
            calendarDays.appendChild(dayElement);
        }
    }

    // 日期格式化函数
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const weekDay = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
        const trainer = selectedTrainer;
        // 根据不同博主使用不同的日期格式
        if (trainer === '祖嘉泽') {
            return `${year}/${month}/${day} 周${weekDay}`;
        } else {
            return `${year}-${month}-${day} 周${weekDay}`;
        }
    }

    // 判断是否是今天
    function isToday(date) {
        const today = new Date();
        return isSameDay(date, today);
    }

    // 判断是否是同一天
    function isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    function isBilibiliUploadPage(url) {
        try {
            const pageUrl = new URL(url);
            const hostname = pageUrl.hostname;
            const isBilibili = hostname === 'bilibili.com' || hostname.endsWith('.bilibili.com');
            return isBilibili && pageUrl.href.includes('upload');
        } catch (error) {
            return false;
        }
    }

    function extractDateFromText(text) {
        const match = String(text || '').match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!match) {
            return null;
        }

        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const date = new Date(year, month - 1, day);

        if (
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day
        ) {
            return null;
        }

        return date;
    }

    function inferTrainerFromText(text) {
        const value = String(text || '');
        if (
            value.includes('祖嘉泽') ||
            value.includes('跟练七天看变化') ||
            value.includes('跟练七天') ||
            value.includes('七天看变化')
        ) {
            return '祖嘉泽';
        }

        if (value.includes('张峰') || value.includes('夜猫子专属') || value.includes('减脂增肌操')) {
            return '张峰';
        }

        return null;
    }

    function getBestDetectedResult(candidates) {
        const results = candidates
            .map((candidate, index) => {
                const date = extractDateFromText(candidate);
                if (!date) {
                    return null;
                }

                const sourceText = String(candidate || '');
                const trainer = inferTrainerFromText(sourceText);
                let score = 1000 - index;

                if (trainer) {
                    score += 10000;
                }
                if (sourceText.includes('.mp4') || sourceText.includes('上传中') || sourceText.includes('已上传')) {
                    score += 800;
                }
                if (sourceText.includes('跟练') || sourceText.includes('夜猫子') || sourceText.includes('减脂')) {
                    score += 500;
                }

                return {
                    date,
                    trainer,
                    sourceText,
                    score
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score);

        if (results.length === 0) {
            return null;
        }

        return {
            date: results[0].date,
            trainer: results[0].trainer || getTrainerFromDetectedCandidates(candidates),
            sourceText: results[0].sourceText
        };
    }

    function getTrainerFromDetectedCandidates(candidates) {
        for (const candidate of candidates) {
            const trainer = inferTrainerFromText(candidate);
            if (trainer) {
                return trainer;
            }
        }

        return null;
    }

    function formatPlainDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const weekDay = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
        return `${year}-${month}-${day} 周${weekDay}`;
    }

    function getDetectedTrainerLabel(result) {
        if (result.trainer) {
            return {
                text: `疑似博主：${result.trainer}`,
                type: 'success-line'
            };
        }

        return {
            text: `未识别博主，沿用：${selectedTrainer}`,
            type: 'warning-line'
        };
    }

    function getCurrentWorkoutLabel() {
        const weekDay = selectedDate.getDay();

        if (selectedTrainer === '祖嘉泽') {
            return {
                text: `时间段：${selectedTime}`,
                type: 'notice-line'
            };
        }

        if (selectedTrainer === '张峰') {
            if (weekDay === 5) {
                return {
                    text: `周五类型：${selectedAerobic}`,
                    type: 'notice-line'
                };
            }

            const trainingType = getTrainingType(selectedTrainer, weekDay);
            return {
                text: trainingType ? `训练类型：${trainingType}` : '训练类型：未配置',
                type: 'notice-line'
            };
        }

        const trainingType = getTrainingType(selectedTrainer, weekDay);
        return {
            text: trainingType ? `时间段：晚间；训练类型：${trainingType}` : '时间段：晚间；训练类型：未配置',
            type: 'notice-line'
        };
    }

    function showDetectedSummary(result) {
        setTitleSource('detected', '已识别投稿页，请确认后填写');
        setDetectSummary([
            `识别到日期：${formatPlainDate(selectedDate)}`,
            getDetectedTrainerLabel(result),
            getCurrentWorkoutLabel()
        ]);
    }

    function getFillSourceNotice() {
        if (titleSource === 'detected') {
            return {
                text: '提醒：本次使用识别结果填写，请确认投稿页内容',
                type: 'source-notice-line'
            };
        }

        if (titleSource === 'manual') {
            return {
                text: '提醒：本次使用手动调整内容填写，请确认投稿页内容',
                type: 'source-notice-line'
            };
        }

        return {
            text: '提醒：本次使用默认日期填写，建议确认投稿页投稿页内容',
            type: 'source-notice-line'
        };
    }

    function applyDetectedResult(result) {
        selectedDate = result.date;
        currentDate = new Date(selectedDate);
        renderCalendar();

        if (result.trainer) {
            selectedTrainer = result.trainer;
            renderTrainerButtons();
            bindTrainerButtonEvents();
            updateTrainerUI();
        } else {
            refreshControls();
        }
    }

    function requestCurrentPageCandidates(tabId, callback) {
        chrome.tabs.sendMessage(tabId, { type: DETECT_MESSAGE_TYPE }, (response) => {
            if (chrome.runtime.lastError) {
                callback({
                    success: false,
                    message: chrome.runtime.lastError.message
                });
                return;
            }

            callback(response || {
                success: false,
                message: '未找到候选文本',
                candidates: []
            });
        });
    }

    function requestFillUploadForm(tabId, payload, callback) {
        chrome.tabs.sendMessage(tabId, {
            type: FILL_MESSAGE_TYPE,
            payload
        }, (response) => {
            if (chrome.runtime.lastError) {
                callback({
                    success: false,
                    message: chrome.runtime.lastError.message,
                    results: []
                });
                return;
            }

            callback(response || {
                success: false,
                message: '未收到投稿页响应',
                results: []
            });
        });
    }

    function isContentScriptNotReady(message) {
        const value = String(message || '');
        return value.includes('Receiving end does not exist') ||
            value.includes('message port closed') ||
            value.includes('The message port closed');
    }

    function getActiveBilibiliUploadTab(callback) {
        if (typeof chrome === 'undefined' || !chrome.tabs) {
            callback({
                success: false,
                message: '当前环境不支持页面操作'
            });
            return;
        }

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            if (!tab || !tab.id) {
                callback({
                    success: false,
                    message: '未找到当前标签页'
                });
                return;
            }

            if (!isBilibiliUploadPage(tab.url || '')) {
                callback({
                    success: false,
                    message: '请在 B 站投稿页使用'
                });
                return;
            }

            callback({
                success: true,
                tab
            });
        });
    }

    function detectCurrentPageTitle() {
        if (!detectBtn) {
            return;
        }

        if (typeof chrome === 'undefined' || !chrome.tabs) {
            setDetectStatus('当前环境不支持页面识别', 'error');
            return;
        }

        detectBtn.disabled = true;
        setDetectStatus('正在识别当前页面...', 'neutral');

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            if (!tab || !tab.id) {
                detectBtn.disabled = false;
                setDetectStatus('未找到当前标签页', 'error');
                return;
            }

            if (!isBilibiliUploadPage(tab.url || '')) {
                detectBtn.disabled = false;
                setDetectStatus('请在 B 站投稿页使用', 'error');
                return;
            }

            requestCurrentPageCandidates(tab.id, (response) => {
                detectBtn.disabled = false;

                if (!response || !response.success) {
                    const notReady = response && isContentScriptNotReady(response.message);
                    setDetectStatus(notReady ? '请重新加载扩展并刷新投稿页后重试' : '未在当前页面找到可识别标题', 'error');
                    return;
                }

                const result = getBestDetectedResult(response.candidates || []);
                if (!result) {
                    setDetectStatus('未识别到标题日期', 'error');
                    return;
                }

                applyDetectedResult(result);
                showDetectedSummary(result);
            });
        });
    }

    function showFillResults(response) {
        const results = response.results || [];
        if (results.length === 0) {
            setFillStatus(response.message || '填写失败，请手动检查', 'error');
            return;
        }

        const lines = [getFillSourceNotice()];
        results.forEach((result) => {
            lines.push({
                text: result.message,
                type: result.success ? 'success-line' : 'warning-line'
            });

            if (!result.success && Array.isArray(result.debug)) {
                result.debug.forEach((debugLine) => {
                    lines.push({
                        text: `诊断：${debugLine}`,
                        type: 'notice-line'
                    });
                });
            }
        });

        setFillStatus(lines, response.success ? 'success' : 'error');
    }

    function setFillProgress(step, message, type = 'notice-line') {
        const existing = fillProgressItems.find((item) => item.step === step);
        const nextItem = {
            step,
            text: message,
            type
        };

        if (existing) {
            Object.assign(existing, nextItem);
        } else {
            fillProgressItems.push(nextItem);
        }

        setFillStatus([
            getFillSourceNotice(),
            ...fillProgressItems.map((item) => ({
                text: item.text,
                type: item.type
            }))
        ], 'neutral');
    }

    function handleFillProgressMessage(message) {
        if (!message || message.type !== FILL_PROGRESS_MESSAGE_TYPE) {
            return;
        }

        if (!activeFillRunId || message.runId !== activeFillRunId) {
            return;
        }

        setFillProgress(message.step, message.message, message.lineType || 'notice-line');
    }

    function fillCurrentUploadPage() {
        if (!fillBtn) {
            return;
        }

        const title = titlePreview.value.trim();
        if (!title) {
            setFillStatus('标题预览为空，请先生成或填写标题', 'error');
            return;
        }

        if (Array.from(title).length > 80) {
            setFillStatus('标题超过 80 字，请缩短后再填写', 'error');
            return;
        }

        fillBtn.disabled = true;
        activeFillRunId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        fillProgressItems = [];
        setFillProgress('start', '正在准备填写到 B 站...', 'notice-line');

        getActiveBilibiliUploadTab((tabResult) => {
            if (!tabResult.success) {
                fillBtn.disabled = false;
                activeFillRunId = null;
                setFillStatus(tabResult.message, 'error');
                return;
            }

            requestFillUploadForm(tabResult.tab.id, {
                runId: activeFillRunId,
                title,
                cover: COVER_CONFIG_BY_TRAINER[selectedTrainer] || null,
                ...DEFAULT_FILL_CONFIG
            }, (response) => {
                fillBtn.disabled = false;
                activeFillRunId = null;

                if (!response || !response.success) {
                    const notReady = response && isContentScriptNotReady(response.message);
                    if (notReady) {
                        setFillStatus('请重新加载扩展并刷新投稿页后重试', 'error');
                        return;
                    }
                }

                showFillResults(response);
            });
        });
    }

    // 获取训练类型 - 优化为支持多博主的通用函数
    function getTrainingType(trainer, weekDay) {
        // 训练类型映射表 - 使用对象字面量替代分散的条件判断
        const trainingMaps = {
            '陈玉轩': {
                1: '臀腿塑形',
                2: '复合训练',
                3: '肩背塑形',
                4: '复合训练',
                5: '腰腹塑形'
            },
            '张峰': {
                1: '臀腿肌力',
                2: '手臂训练',
                3: '肩背肌力',
                4: '核心肌力',
                5: '有氧双冠'
            }
        };
        return trainingMaps[trainer]?.[weekDay] || '';
    }

    // 复制标题
    function copyTitle() {
        const title = titlePreview.value.trim();
        if (!title) {
            alert('没有可复制的标题！');
            return;
        }
        copyToClipboard(title);
    }

    // 复制到剪贴板
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            successMessage.classList.add('show');
            setTimeout(() => {
                successMessage.classList.remove('show');
            }, 2000);
        });
    }

    // 初始化事件监听
    generateBtn.addEventListener('click', copyTitle);
    if (detectBtn) {
        detectBtn.addEventListener('click', detectCurrentPageTitle);
    }
    if (fillBtn) {
        fillBtn.addEventListener('click', fillCurrentUploadPage);
    }
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(handleFillProgressMessage);
    }

    // 快捷按钮事件监听
    shortcutButtons.forEach(button => {
        button.addEventListener('click', () => {
            const days = parseInt(button.dataset.days);
            selectedDate = new Date();
            selectedDate.setDate(selectedDate.getDate() + days);
            currentDate = new Date(selectedDate);
            markManualAdjustment('已手动调整日期，将按当前选择填写');
            renderCalendar();
            refreshControls();
        });
    });

    if (titlePreview) {
        titlePreview.addEventListener('input', () => {
            markManualAdjustment('已手动编辑标题，将按预览内容填写');
        });
    }

    // 初始化日历
    initCalendar();
    refreshControls();
    setTitleSource('default');
});

document.addEventListener('DOMContentLoaded', function() {
    const dateInput = document.querySelector('.date-picker-input');
    const calendar = document.querySelector('.date-picker-calendar');
    const calendarDays = document.querySelector('.calendar-days');
    const calendarTitle = document.querySelector('.calendar-title');
    const prevMonthBtn = document.querySelector('.prev-month');
    const nextMonthBtn = document.querySelector('.next-month');
    const generateBtn = document.getElementById('generate');
    const detectBtn = document.getElementById('detectCurrentPage');
    const detectStatus = document.getElementById('detectStatus');
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

    const DETECT_MESSAGE_TYPE = 'GET_UPLOAD_TITLE_CANDIDATES';

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

    // 添加博主选择事件监听
    function bindTrainerButtonEvents() {
        trainerButtons.forEach(button => {
            button.addEventListener('click', function() {
                // 移除其他按钮的激活状态
                trainerButtons.forEach(btn => btn.classList.remove('active'));
                // 激活当前按钮
                this.classList.add('active');
                selectedTrainer = this.dataset.trainer;

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
        if (value.includes('跟练七天看变化')) {
            return '祖嘉泽';
        }

        if (value.includes('夜猫子专属') || value.includes('减脂增肌操')) {
            return '张峰';
        }

        return null;
    }

    function getBestDetectedResult(candidates) {
        for (const candidate of candidates) {
            const date = extractDateFromText(candidate);
            if (date) {
                return {
                    date,
                    trainer: inferTrainerFromText(candidate),
                    sourceText: candidate
                };
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
        setDetectSummary([
            `识别到日期：${formatPlainDate(selectedDate)}`,
            getDetectedTrainerLabel(result),
            getCurrentWorkoutLabel()
        ]);
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
                    const notReady = response && response.message && response.message.includes('Receiving end does not exist');
                    setDetectStatus(notReady ? '请刷新 B 站投稿页后重试' : '未在当前页面找到可识别标题', 'error');
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

    // 快捷按钮事件监听
    shortcutButtons.forEach(button => {
        button.addEventListener('click', () => {
            const days = parseInt(button.dataset.days);
            selectedDate = new Date();
            selectedDate.setDate(selectedDate.getDate() + days);
            currentDate = new Date(selectedDate);
            renderCalendar();
            refreshControls();
        });
    });

    // 初始化日历
    initCalendar();
    refreshControls();
});

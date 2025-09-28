document.addEventListener('DOMContentLoaded', function() {
    const dateInput = document.querySelector('.date-picker-input');
    const calendar = document.querySelector('.date-picker-calendar');
    const calendarDays = document.querySelector('.calendar-days');
    const calendarTitle = document.querySelector('.calendar-title');
    const prevMonthBtn = document.querySelector('.prev-month');
    const nextMonthBtn = document.querySelector('.next-month');
    const generateBtn = document.getElementById('generate');
    const resultDiv = document.getElementById('result');
    const successMessage = document.querySelector('.success-message');
    const shortcutButtons = document.querySelectorAll('.shortcut-button');
    const trainerButtons = document.querySelectorAll('.trainer-button');
    const aerobicButtons = document.querySelectorAll('.aerobic-button');
    const timeButtons = document.querySelectorAll('.time-button');
    const timeGroup = document.getElementById('timeGroup');
    const aerobicGroup = document.getElementById('aerobicGroup');

    let currentDate = new Date();
    let selectedDate = null;

    let selectedTrainer = '祖嘉泽';
    let selectedAerobic = '沉浸有氧';
    let selectedTime = '晚间';

    // 添加博主选择事件监听
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

            // 处理张峰周五的特殊情况
            updateAerobicGroup();
        });
    });

    // 添加有氧类型选择事件监听
    aerobicButtons.forEach(button => {
        button.addEventListener('click', function() {
            // 移除其他按钮的激活状态
            aerobicButtons.forEach(btn => btn.classList.remove('active'));
            // 激活当前按钮
            this.classList.add('active');
            selectedAerobic = this.dataset.aerobic;
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
        updateAerobicGroup();
    }

    updateTrainerUI();

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
                dateInput.value = formatDate(selectedDate);
                calendar.classList.remove('calendar-show');

                // 移除其他日期的选中状态
                document.querySelectorAll('.calendar-day.selected').forEach(el => {
                    el.classList.remove('selected');
                });

                // 添加当前日期的选中状态
                dayElement.classList.add('selected');

                // 更新有氧选择组显示状态
                updateAerobicGroup();
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

    // 生成标题
    function generateTitle() {
        if (!selectedDate) {
            alert('请选择日期！');
            return;
        }

        const trainer = selectedTrainer;
        const time = selectedTime;
        const weekDay = selectedDate.getDay();
        const dateStr = formatDate(selectedDate);
        let title = '';

        if (trainer === '祖嘉泽') {
            title = `「${dateStr}｜${time}」祖嘉泽有氧健身 直播回放录屏完整版`;
        } else if (trainer === '张峰') {
            let trainingType = getTrainingType(trainer, weekDay);
            // 如果是周五，使用用户选择的有氧类型
            if (weekDay === 5) {
                trainingType = selectedAerobic;
            }
            title = `「${dateStr}｜${trainingType}」张峰-Give Me Five 直播回放录屏完整版`;
        } else {
            const trainingType = getTrainingType(trainer, weekDay);
            title = `「${dateStr}｜晚间｜${trainingType}」陈玉轩-轩誓肌动 直播回放录屏完整版`;
        }

        resultDiv.textContent = title;
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
    generateBtn.addEventListener('click', generateTitle);

    // 快捷按钮事件监听
    shortcutButtons.forEach(button => {
        button.addEventListener('click', () => {
            const days = parseInt(button.dataset.days);
            selectedDate = new Date();
            selectedDate.setDate(selectedDate.getDate() + days);
            dateInput.value = formatDate(selectedDate);
            currentDate = new Date(selectedDate);
            renderCalendar();
            updateAerobicGroup();
        });
    });

    // 初始化日历
    initCalendar();
});
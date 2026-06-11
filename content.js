(function() {
    const DETECT_MESSAGE_TYPE = 'GET_UPLOAD_TITLE_CANDIDATES';
    const FILL_MESSAGE_TYPE = 'FILL_UPLOAD_FORM';
    const FILL_PROGRESS_MESSAGE_TYPE = 'FILL_UPLOAD_PROGRESS';
    const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;

    function isVisible(element) {
        if (!element || !(element instanceof Element)) {
            return false;
        }

        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
            return false;
        }

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function normalizeText(text) {
        return String(text || '').replace(/\s+/g, ' ').trim();
    }

    function isDeclarationLabelText(text) {
        const value = normalizeText(text).replace(/^\*\s*/, '');
        return value.includes('创作') &&
            value.includes('声明') &&
            !value.includes('授权') &&
            value.length <= 40;
    }

    function addCandidate(candidates, text) {
        const normalized = normalizeText(text);
        if (!normalized || !DATE_PATTERN.test(normalized)) {
            return;
        }

        if (!candidates.includes(normalized)) {
            candidates.push(normalized);
        }
    }

    function collectCandidates() {
        const candidates = [];

        document.querySelectorAll('input, textarea').forEach((element) => {
            if (!isVisible(element)) {
                return;
            }

            addCandidate(candidates, element.value);
            addCandidate(candidates, element.getAttribute('title'));
            addCandidate(candidates, element.getAttribute('aria-label'));
            addCandidate(candidates, element.getAttribute('placeholder'));
        });

        document.querySelectorAll('[title], [aria-label]').forEach((element) => {
            if (!isVisible(element)) {
                return;
            }

            addCandidate(candidates, element.getAttribute('title'));
            addCandidate(candidates, element.getAttribute('aria-label'));
        });

        document.querySelectorAll('span, div, p, label').forEach((element) => {
            if (!isVisible(element)) {
                return;
            }

            const text = normalizeText(element.textContent);
            if (text.length <= 240) {
                addCandidate(candidates, text);
            }
        });

        return candidates.slice(0, 20);
    }

    function getFieldContextText(element) {
        let current = element;
        const parts = [];

        for (let i = 0; i < 5 && current; i++) {
            parts.push(normalizeText(current.textContent));
            current = current.parentElement;
        }

        return parts.join(' ').slice(0, 500);
    }

    function getTextInputType(element) {
        return String(element.getAttribute('type') || 'text').toLowerCase();
    }

    function scoreTitleControl(element) {
        const type = getTextInputType(element);
        if (element.tagName === 'INPUT' && !['text', 'search'].includes(type)) {
            return -1;
        }

        if (element.disabled || element.readOnly || !isVisible(element)) {
            return -1;
        }

        const value = normalizeText(element.value);
        const attrs = normalizeText([
            element.getAttribute('placeholder'),
            element.getAttribute('title'),
            element.getAttribute('aria-label')
        ].filter(Boolean).join(' '));
        const context = getFieldContextText(element);
        const maxLength = Number(element.getAttribute('maxlength') || element.maxLength || 0);
        const rect = element.getBoundingClientRect();

        let score = 0;

        if (attrs.includes('标题')) {
            score += 5;
        }
        if (context.includes('标题')) {
            score += 4;
        }
        if (DATE_PATTERN.test(value)) {
            score += 5;
        }
        if (maxLength >= 60 && maxLength <= 100) {
            score += 4;
        }
        if (rect.width >= 300) {
            score += 1;
        }
        if (element.tagName === 'INPUT') {
            score += 1;
        }

        return score;
    }

    function findTitleInput() {
        const controls = Array.from(document.querySelectorAll('input, textarea'))
            .map((element) => ({
                element,
                score: scoreTitleControl(element)
            }))
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score);

        return controls[0]?.element || null;
    }

    function setNativeValue(element, value) {
        const prototype = element instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

        if (descriptor && descriptor.set) {
            descriptor.set.call(element, value);
        } else {
            element.value = value;
        }
    }

    function dispatchInputEvents(element) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    function delay(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    function getElementCenter(element) {
        const rect = getElementRect(element);
        if (!rect) {
            return {
                x: 0,
                y: 0
            };
        }

        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    function clickElementAt(element, point) {
        const eventOptions = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: point.x,
            clientY: point.y,
            screenX: window.screenX + point.x,
            screenY: window.screenY + point.y,
            button: 0,
            buttons: 1
        };

        element.focus?.();
        element.dispatchEvent(new PointerEvent('pointermove', eventOptions));
        element.dispatchEvent(new MouseEvent('mousemove', eventOptions));
        element.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
        element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
        element.dispatchEvent(new PointerEvent('pointerup', {
            ...eventOptions,
            buttons: 0
        }));
        element.dispatchEvent(new MouseEvent('mouseup', {
            ...eventOptions,
            buttons: 0
        }));
        element.dispatchEvent(new MouseEvent('click', {
            ...eventOptions,
            buttons: 0
        }));
        if (typeof element.click === 'function') {
            element.click();
        }
    }

    function clickElement(element) {
        clickElementAt(element, getElementCenter(element));
    }

    function clickPoint(point) {
        const target = document.elementFromPoint(point.x, point.y) || document.body;
        clickElementAt(target, point);
    }

    function hoverElement(element) {
        const point = getElementCenter(element);
        const eventOptions = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: point.x,
            clientY: point.y,
            screenX: window.screenX + point.x,
            screenY: window.screenY + point.y
        };

        element.dispatchEvent(new PointerEvent('pointermove', eventOptions));
        element.dispatchEvent(new MouseEvent('mousemove', eventOptions));
        element.dispatchEvent(new PointerEvent('pointerover', eventOptions));
        element.dispatchEvent(new MouseEvent('mouseover', eventOptions));
        element.dispatchEvent(new PointerEvent('pointerenter', eventOptions));
        element.dispatchEvent(new MouseEvent('mouseenter', eventOptions));
    }

    async function waitFor(getter, timeout = 1200, interval = 80) {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeout) {
            const value = getter();
            if (value) {
                return value;
            }
            await delay(interval);
        }
        return null;
    }

    function findTextElement(text, root = document) {
        const expected = normalizeText(text);
        const elements = Array.from(root.querySelectorAll('button, div, span, li, p'));

        return elements
            .filter((element) => {
                if (!isVisible(element)) {
                    return false;
                }

                const value = normalizeText(element.textContent);
                if (value !== expected || value.length > 60) {
                    return false;
                }

                return !Array.from(element.children).some((child) => normalizeText(child.textContent) === expected);
            })
            .sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0] || null;
    }

    function getClickableOptionElement(element, optionText = '') {
        const expected = normalizeText(optionText);
        let current = element;
        for (let i = 0; i < 8 && current; i++) {
            const role = current.getAttribute('role');
            const tagName = current.tagName;
            const className = String(current.className || '').toLowerCase();
            const text = normalizeText(current.textContent);
            const rect = getElementRect(current);
            const textMatches = !expected || text.includes(expected);
            const sizeLooksLikeRow = rect && rect.width >= 120 && rect.height >= 28 && rect.height <= 96;
            if (
                textMatches &&
                (
                    className.includes('bcc-option') ||
                    tagName === 'LI' ||
                    tagName === 'BUTTON' ||
                    role === 'option' ||
                    role === 'menuitem' ||
                    current.hasAttribute('aria-selected') ||
                    className.includes('option') ||
                    className.includes('select-option') ||
                    className.includes('select-item') ||
                    className.includes('dropdown-item') ||
                    className.includes('menu-item') ||
                    className.includes('bcc-select-item') ||
                    (sizeLooksLikeRow && className.includes('item'))
                )
            ) {
                return current;
            }
            current = current.parentElement;
        }

        return element;
    }

    function findChildTextElement(element, text) {
        const expected = normalizeText(text);
        return Array.from(element.querySelectorAll?.('button, div, span, li, p') || [])
            .filter((child) => {
                return isVisible(child) && normalizeText(child.textContent) === expected;
            })
            .sort((a, b) => {
                const aRect = a.getBoundingClientRect();
                const bRect = b.getBoundingClientRect();
                return (aRect.width * aRect.height) - (bRect.width * bRect.height);
            })[0] || null;
    }

    async function clickOptionElement(option, optionText = '') {
        const clickableOption = getClickableOptionElement(option, optionText);
        const rect = getElementRect(clickableOption) || getElementRect(option);

        if (!rect) {
            dispatchHiddenClick(clickableOption);
            return;
        }

        const point = {
            x: rect.left + Math.min(Math.max(rect.width / 2, 32), rect.width - 24),
            y: rect.top + rect.height / 2
        };

        hoverElement(clickableOption);
        await delay(40);
        clickElementAt(clickableOption, point);
    }

    function dispatchHiddenClick(element) {
        if (!element) {
            return;
        }

        element.focus?.();
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((eventName) => {
            const EventConstructor = eventName.startsWith('pointer') ? PointerEvent : MouseEvent;
            element.dispatchEvent(new EventConstructor(eventName, {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 0,
                buttons: eventName.endsWith('down') ? 1 : 0
            }));
        });
        element.click?.();
    }

    function dispatchSelectionCommitEvents(control) {
        if (!control) {
            return;
        }

        const targets = [
            control,
            control.querySelector?.('input, textarea, [role="combobox"]')
        ].filter(Boolean);

        targets.forEach((target) => {
            target.focus?.();
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
            target.dispatchEvent(new Event('blur', { bubbles: true }));
        });
    }

    function getElementRect(element) {
        if (!element || !isVisible(element)) {
            return null;
        }

        return element.getBoundingClientRect();
    }

    function getRectCenterY(rect) {
        return rect.top + rect.height / 2;
    }

    function isDropdownControl(element) {
        const tagName = element.tagName;
        const role = element.getAttribute('role');
        const className = String(element.className || '').toLowerCase();
        const attrs = normalizeText([
            element.getAttribute('placeholder'),
            element.getAttribute('aria-label'),
            element.getAttribute('title')
        ].filter(Boolean).join(' '));

        return tagName === 'INPUT' ||
            tagName === 'BUTTON' ||
            role === 'combobox' ||
            element.hasAttribute('aria-haspopup') ||
            className.includes('select') ||
            className.includes('dropdown') ||
            attrs.includes('选择') ||
            attrs.includes('分区') ||
            attrs.includes('声明');
    }

    function getControlText(control) {
        return normalizeText([
            control?.value,
            control?.textContent,
            control?.getAttribute('title'),
            control?.getAttribute('aria-label')
        ].filter(Boolean).join(' '));
    }

    function getSelectDisplayText(control) {
        if (!control) {
            return '';
        }

        const selectRoot = control.closest?.('.bcc-select, [role="combobox"], [aria-haspopup]') || control;
        const targets = [
            control,
            selectRoot.querySelector?.('.bcc-select-input-wrap'),
            selectRoot.querySelector?.('.bcc-select-selection-item'),
            selectRoot.querySelector?.('.bcc-select-selector'),
            selectRoot.querySelector?.('input')
        ].filter(Boolean);

        for (const target of targets) {
            const value = normalizeText([
                target.value,
                target.textContent,
                target.getAttribute?.('title'),
                target.getAttribute?.('aria-label')
            ].filter(Boolean).join(' '));

            if (value) {
                return value;
            }
        }

        return '';
    }

    function isBccOptionSelected(control, optionText) {
        const expected = normalizeText(optionText);
        const selectRoot = getSelectRoot(control);
        const options = Array.from(selectRoot?.querySelectorAll?.('.bcc-option.selected') || []);

        return options.some((option) => normalizeText(option.textContent).includes(expected));
    }

    function getElementDescription(element) {
        if (!element) {
            return '未找到元素';
        }

        const rect = getElementRect(element);
        const className = String(element.className || '').replace(/\s+/g, '.').slice(0, 80);
        const text = getControlText(element).slice(0, 80);
        const rectText = rect
            ? `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)}x${Math.round(rect.height)}`
            : '无坐标';

        return `${element.tagName.toLowerCase()}${className ? '.' + className : ''} [${rectText}] "${text}"`;
    }

    function getVisibleExactTextDescriptions(text, limit = 8) {
        const expected = normalizeText(text);
        return Array.from(document.querySelectorAll('button, div, span, li, p'))
            .filter((element) => {
                return isVisible(element) &&
                    normalizeText(element.textContent) === expected &&
                    !Array.from(element.children).some((child) => normalizeText(child.textContent) === expected);
            })
            .slice(0, limit)
            .map(getElementDescription);
    }

    function getFieldDebug(labelText, optionText, control, option) {
        const openTargets = control ? getDropdownOpenTargets(control).slice(0, 5).map(getElementDescription) : [];
        const exactOptions = getVisibleExactTextDescriptions(optionText);
        const selectDebug = labelText === '创作声明'
            ? getSelectStructureDebug(control, optionText)
            : [];

        return [
            `控件：${getElementDescription(control)}`,
            `选项：${getElementDescription(option)}`,
            `可点目标：${openTargets.join(' | ') || '无'}`,
            `页面同名选项：${exactOptions.join(' | ') || '无'}`,
            ...selectDebug
        ];
    }

    function getElementStructureDescription(element) {
        const rect = getElementRect(element);
        const className = String(element.className || '').replace(/\s+/g, '.').slice(0, 80);
        const role = element.getAttribute?.('role') || '';
        const ariaSelected = element.getAttribute?.('aria-selected') || '';
        const style = window.getComputedStyle(element);
        const text = getControlText(element).slice(0, 80);
        const rectText = rect
            ? `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)}x${Math.round(rect.height)}`
            : '无坐标';

        return `${element.tagName.toLowerCase()}${className ? '.' + className : ''} role="${role}" selected="${ariaSelected}" display="${style.display}" visibility="${style.visibility}" opacity="${style.opacity}" [${rectText}] "${text}"`;
    }

    function getSelectStructureDebug(control, optionText) {
        if (!control) {
            return [];
        }

        const expected = normalizeText(optionText);
        const selectRoot = getSelectRoot(control);
        const dropdownRoots = Array.from(document.querySelectorAll('.bcc-select-dropdown, .bcc-select-options, .bcc-select-menu, .bcc-dropdown, .bcc-popover, [role="listbox"], [role="menu"]'));
        const roots = [selectRoot, ...dropdownRoots].filter(Boolean);
        const candidates = roots
            .flatMap((root) => Array.from(root.querySelectorAll?.('li, button, div, span, input, [role], [aria-selected]') || []))
            .filter((element, index, list) => {
                if (list.indexOf(element) !== index) {
                    return false;
                }

                const text = getControlText(element);
                const className = String(element.className || '').toLowerCase();
                return text.includes(expected) ||
                    /option|item|menu|dropdown|select|input/.test(className) ||
                    element.hasAttribute?.('aria-selected') ||
                    element.getAttribute?.('role');
            })
            .slice(0, 12)
            .map(getElementStructureDescription);

        return [
            `声明select结构：${candidates.join(' | ') || '无'}`
        ];
    }

    function getAncestorText(element, depth = 6) {
        let current = element;
        const parts = [];

        for (let i = 0; i < depth && current; i++) {
            parts.push(normalizeText(current.textContent));
            current = current.parentElement;
        }

        return parts.join(' ');
    }

    function getClassChain(element, depth = 6) {
        let current = element;
        const parts = [];

        for (let i = 0; i < depth && current; i++) {
            parts.push(String(current.className || '').toLowerCase());
            current = current.parentElement;
        }

        return parts.join(' ');
    }

    function isInUploadTagArea(element) {
        const text = getAncestorText(element, 8);
        return text.includes('推荐标签') || text.includes('参与话题') || text.includes('还可以添加') || text.includes('按回车');
    }

    function findControlNearLabel(labelText) {
        const label = findLabelElement(labelText);
        const labelRect = getElementRect(label);
        if (!labelRect) {
            return null;
        }

        const labelCenterY = getRectCenterY(labelRect);
        const elements = Array.from(document.querySelectorAll('input, textarea, button, [role="combobox"], [aria-haspopup], div, span'));

        return elements
            .map((element) => {
                if (!isVisible(element) || element.disabled) {
                    return null;
                }

                const rect = getElementRect(element);
                const text = normalizeText(element.textContent);
                if (!rect || rect.width < 120 || rect.height < 28) {
                    return null;
                }
                if (text === labelText || text === '* ' + labelText) {
                    return null;
                }
                if (rect.left < labelRect.right - 20) {
                    return null;
                }

                const verticalDistance = Math.abs(getRectCenterY(rect) - labelCenterY);
                if (verticalDistance > 90) {
                    return null;
                }

                const horizontalDistance = Math.max(0, rect.left - labelRect.right);
                const dropdownBonus = isDropdownControl(element) ? -80 : 0;
                const textPenalty = text.length > 40 ? 80 : 0;
                const rowPenalty = verticalDistance * 4;
                const score = rowPenalty + horizontalDistance + textPenalty + dropdownBonus;

                return {
                    element,
                    score
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.score - b.score)[0]?.element || null;
    }

    function findLabelElement(labelText) {
        const expected = normalizeText(labelText);
        const elements = Array.from(document.querySelectorAll('label, span, div, p'));

        return elements
            .map((element) => {
                if (!isVisible(element)) {
                    return null;
                }

                const value = normalizeText(element.textContent).replace(/^\*\s*/, '');
                const isExact = value === expected;
                const isPrefix = value.startsWith(`${expected} `);
                const isDeclarationAlias = expected === '创作声明' && isDeclarationLabelText(value);
                if (!isExact && !isPrefix && !isDeclarationAlias) {
                    return null;
                }

                const declarationAliasScore = isDeclarationAlias
                    ? (value.includes('性质') ? -4 : -2)
                    : 0;
                const exactScore = isExact ? -6 : 0;
                const requiredScore = normalizeText(element.textContent).startsWith('*') ? -1 : 0;

                return {
                    element,
                    score: exactScore + declarationAliasScore + requiredScore + value.length * 0.01
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.score - b.score)[0]?.element || null;
    }

    function findDeclarationFieldContainer() {
        const containers = Array.from(document.querySelectorAll('.statement-content, .bcc-select'))
            .map((element) => {
                const select = element.matches?.('.bcc-select')
                    ? element
                    : element.querySelector?.('.bcc-select');
                if (!select || !isVisible(select)) {
                    return null;
                }

                const input = select.querySelector('input');
                const placeholder = normalizeText(input?.getAttribute('placeholder'));
                const text = normalizeText(select.textContent);
                const isDeclarationSelect = placeholder.includes('创作声明') ||
                    placeholder.includes('视频内容') ||
                    text.includes('内容无需标注') ||
                    text.includes('含AI生成内容') ||
                    text.includes('内容授权声明');
                if (!isDeclarationSelect) {
                    return null;
                }

                return element.matches?.('.statement-content')
                    ? element
                    : (element.closest?.('.statement-content') || element);
            })
            .filter(Boolean);

        return containers[0] || null;
    }

    function getFieldContainer(labelText) {
        const label = findLabelElement(labelText);
        if (!label && labelText === '创作声明') {
            return findDeclarationFieldContainer();
        }

        let current = label;

        for (let i = 0; i < 5 && current; i++) {
            const text = normalizeText(current.textContent);
            const hasInputs = current.querySelector('input, textarea, [role="combobox"], [aria-haspopup], button');
            if (hasInputs && text.includes(labelText)) {
                return current;
            }
            current = current.parentElement;
        }

        return label ? label.parentElement : (labelText === '创作声明' ? findDeclarationFieldContainer() : null);
    }

    function findClickableControl(container, labelText) {
        if (!container) {
            return null;
        }

        const nearbyControl = findControlNearLabel(labelText);
        if (nearbyControl) {
            return nearbyControl;
        }

        const candidates = Array.from(container.querySelectorAll('input, textarea, button, [role="combobox"], [aria-haspopup], div, span'))
            .filter((element) => {
                if (!isVisible(element) || element.disabled) {
                    return false;
                }

                const text = normalizeText(element.textContent);
                const attrs = normalizeText([
                    element.getAttribute('placeholder'),
                    element.getAttribute('aria-label'),
                    element.getAttribute('title')
                ].filter(Boolean).join(' '));
                const rect = element.getBoundingClientRect();

                if (text === labelText || text === '* ' + labelText) {
                    return false;
                }

                return element.tagName === 'INPUT' ||
                    element.tagName === 'TEXTAREA' ||
                    element.tagName === 'BUTTON' ||
                    element.getAttribute('role') === 'combobox' ||
                    element.hasAttribute('aria-haspopup') ||
                    attrs.includes(labelText) ||
                    (rect.width >= 120 && rect.height >= 28 && text.length <= 30);
            });

        return candidates
            .sort((a, b) => {
                const aInput = a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' ? 1 : 0;
                const bInput = b.tagName === 'INPUT' || b.tagName === 'TEXTAREA' ? 1 : 0;
                if (aInput !== bInput) {
                    return aInput - bInput;
                }

                const aRole = a.getAttribute('role') === 'combobox' || a.hasAttribute('aria-haspopup') ? 0 : 1;
                const bRole = b.getAttribute('role') === 'combobox' || b.hasAttribute('aria-haspopup') ? 0 : 1;
                if (aRole !== bRole) {
                    return aRole - bRole;
                }

                const aRect = a.getBoundingClientRect();
                const bRect = b.getBoundingClientRect();
                return (bRect.width * bRect.height) - (aRect.width * aRect.height);
            })[0] || null;
    }

    function getDropdownOpenTargets(control) {
        const rect = getElementRect(control);
        const targets = [control];

        if (control) {
            let current = control.parentElement;
            for (let i = 0; i < 5 && current; i++) {
                const className = String(current.className || '').toLowerCase();
                const role = current.getAttribute('role');
                if (
                    className.includes('bcc-select') ||
                    className.includes('select') ||
                    className.includes('selector') ||
                    role === 'combobox' ||
                    current.hasAttribute('aria-haspopup')
                ) {
                    targets.push(current);
                }
                current = current.parentElement;
            }

            Array.from(control.querySelectorAll?.('input, button, [role="combobox"], [aria-haspopup], .bcc-select, .bcc-select-input, .bcc-select-selector') || [])
                .filter(isVisible)
                .forEach((element) => {
                    targets.push(element);
                });
        }

        if (rect) {
            const arrowTarget = document.elementFromPoint(rect.right - 24, rect.top + rect.height / 2);
            const leftTarget = document.elementFromPoint(rect.left + 24, rect.top + rect.height / 2);
            if (arrowTarget) {
                targets.push(arrowTarget);
            }
            if (leftTarget) {
                targets.push(leftTarget);
            }
        }

        return targets.filter((target, index, list) => {
            return target && list.indexOf(target) === index;
        });
    }

    function dispatchKeyboardOpen(element) {
        element.focus?.();
        ['keydown', 'keyup'].forEach((eventName) => {
            element.dispatchEvent(new KeyboardEvent(eventName, {
                bubbles: true,
                cancelable: true,
                key: 'ArrowDown',
                code: 'ArrowDown',
                keyCode: 40,
                which: 40
            }));
        });
    }

    function dispatchKeyboardSelect(element, key, code, keyCode) {
        element.focus?.();
        ['keydown', 'keypress', 'keyup'].forEach((eventName) => {
            element.dispatchEvent(new KeyboardEvent(eventName, {
                bubbles: true,
                cancelable: true,
                key,
                code,
                keyCode,
                which: keyCode
            }));
        });
    }

    async function selectDropdownFirstOptionByKeyboard(control, optionText) {
        const target = getPrimaryDropdownTarget(control);
        const input = target.querySelector?.('input') ||
            control.querySelector?.('input') ||
            getSelectRoot(control)?.querySelector?.('input') ||
            target;
        const rect = getElementRect(target);

        const tryKeyboard = async () => {
            input.focus?.();
            await delay(80);
            dispatchKeyboardSelect(input, 'ArrowDown', 'ArrowDown', 40);
            await delay(180);
            dispatchKeyboardSelect(input, 'Enter', 'Enter', 13);
            await delay(260);
            dispatchSelectionCommitEvents(control);
            return getSelectDisplayText(control).includes(optionText) || isBccOptionSelected(control, optionText);
        };

        if (await tryKeyboard()) {
            return true;
        }

        if (rect) {
            clickPoint({
                x: rect.left + Math.min(Math.max(rect.width / 2, 48), rect.width - 32),
                y: rect.top + rect.height / 2
            });
            await delay(180);
        } else {
            clickElement(target);
            await delay(180);
        }

        return tryKeyboard();
    }

    function getPrimaryDropdownTarget(control) {
        return getDropdownOpenTargets(control).find((target) => {
            const className = String(target.className || '').toLowerCase();
            return className.includes('bcc-select') && !className.includes('input-wrap');
        }) || control;
    }

    function getSelectRoot(control) {
        return control?.closest?.('.bcc-select, [role="combobox"], [aria-haspopup]') || control;
    }

    function findBccSelectOption(control, optionText) {
        const expected = normalizeText(optionText);
        const controlRect = getElementRect(control);
        const selectRoot = getSelectRoot(control);
        const roots = [
            selectRoot,
            ...Array.from(selectRoot?.querySelectorAll?.('.bcc-select-list-wrap, .bcc-select-option-list') || []),
            ...Array.from(document.querySelectorAll('.bcc-select-dropdown, .bcc-select-options, .bcc-select-menu, .bcc-dropdown, .bcc-popover, [role="listbox"], [role="menu"]'))
        ].filter(Boolean);

        return roots
            .flatMap((root) => Array.from(root.querySelectorAll?.('.bcc-option, .option-hover-tips, li, button, div, span, [role="option"], [aria-selected]') || []))
            .map((element) => {
                const value = normalizeText(element.textContent);
                const className = String(element.className || '').toLowerCase();
                const isBccOption = className.includes('bcc-option');
                if (!isVisible(element) && !isBccOption) {
                    return null;
                }
                if (!value.includes(expected) || (!isBccOption && value.length > 180)) {
                    return null;
                }

                const textElement = value === expected || isBccOption
                    ? element
                    : findChildTextElement(element, expected);
                if (!textElement) {
                    return null;
                }

                const clickable = getClickableOptionElement(textElement, optionText);
                const rect = getElementRect(clickable) || getElementRect(textElement);
                if (!rect && !isBccOption) {
                    return null;
                }

                if (controlRect && rect) {
                    const isInsideControl = rect.top >= controlRect.top - 2 &&
                        rect.bottom <= controlRect.bottom + 2 &&
                        rect.left >= controlRect.left - 2 &&
                        rect.right <= controlRect.right + 2;
                    if (isInsideControl || rect.top < controlRect.bottom - 4) {
                        return null;
                    }
                }

                const classChain = getClassChain(clickable, 4);
                const optionBonus = /bcc-option|option|item|menu|dropdown|select/.test(classChain) || clickable.hasAttribute('aria-selected') ? -300 : 0;
                const yDistance = rect
                    ? (controlRect ? Math.abs(rect.top - controlRect.bottom) : rect.top)
                    : 0;

                return {
                    element: clickable,
                    score: yDistance + optionBonus
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.score - b.score)[0]?.element || null;
    }

    async function selectFirstDropdownOption(control) {
        const target = getPrimaryDropdownTarget(control);
        const rect = getElementRect(target);

        if (!rect) {
            return false;
        }

        clickElementAt(target, {
            x: rect.right - Math.min(24, rect.width / 2),
            y: rect.top + rect.height / 2
        });
        await delay(320);

        const option = findBccSelectOption(control, '内容无需标注');
        if (option) {
            await clickOptionElement(option, '内容无需标注');
            await delay(220);
            return true;
        }

        const x = rect.left + Math.min(Math.max(rect.width / 2, 48), rect.width - 32);
        const yOffsets = [44, 56, 68];

        for (const offset of yOffsets) {
            clickPoint({
                x,
                y: rect.bottom + offset
            });
            await delay(220);

            if (getSelectDisplayText(control).includes('内容无需标注') || isBccOptionSelected(control, '内容无需标注')) {
                return true;
            }

            clickElementAt(target, {
                x: rect.right - Math.min(24, rect.width / 2),
                y: rect.top + rect.height / 2
            });
            await delay(180);
        }

        return getSelectDisplayText(control).includes('内容无需标注') || isBccOptionSelected(control, '内容无需标注');
    }

    async function openDropdownAndFindOption(control, optionText, field) {
        const findOption = () => {
            return (field === 'declaration' ? findBccSelectOption(control, optionText) : null) ||
                findDropdownOption(optionText, control, field) ||
                (field === 'declaration' ? findOptionNearControl(optionText, control) : null);
        };
        if (field !== 'declaration') {
            const initialOption = findOption();
            if (initialOption) {
                return initialOption;
            }
        }

        for (const target of getDropdownOpenTargets(control)) {
            const rect = getElementRect(target);
            if (rect) {
                clickElementAt(target, {
                    x: rect.right - Math.min(24, rect.width / 2),
                    y: rect.top + rect.height / 2
                });
            } else {
                clickElement(target);
            }

            const option = await waitFor(findOption, field === 'declaration' ? 1200 : 650);
            if (option) {
                return option;
            }
        }

        const searchInput = field === 'declaration'
            ? null
            : (control.matches?.('input') ? control : control.querySelector?.('input'));
        if (searchInput && isVisible(searchInput)) {
            searchInput.focus();
            setNativeValue(searchInput, optionText);
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
            const option = await waitFor(findOption, 900);
            if (option) {
                return option;
            }
            setNativeValue(searchInput, '');
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        dispatchKeyboardOpen(control);
        return waitFor(findOption, 900);
    }

    function findOptionNearControl(optionText, control) {
        const expected = normalizeText(optionText);
        const controlRect = getElementRect(control);
        if (!controlRect) {
            return findTextElement(optionText);
        }

        const controlCenterX = controlRect.left + controlRect.width / 2;
        const elements = Array.from(document.querySelectorAll('button, div, span, li, p'));

        return elements
            .map((element) => {
                if (!isVisible(element)) {
                    return null;
                }

                const value = normalizeText(element.textContent);
                if (value !== expected || value.length > 60) {
                    return null;
                }
                if (Array.from(element.children).some((child) => normalizeText(child.textContent) === expected)) {
                    return null;
                }

                const rect = getElementRect(element);
                if (!rect) {
                    return null;
                }
                const isInsideControl = rect.top >= controlRect.top - 2 &&
                    rect.bottom <= controlRect.bottom + 2 &&
                    rect.left >= controlRect.left - 2 &&
                    rect.right <= controlRect.right + 2;
                if (isInsideControl) {
                    return null;
                }
                if (rect.top < controlRect.bottom - 4) {
                    return null;
                }
                if (rect.top < controlRect.top - 20 || rect.top - controlRect.bottom > 360) {
                    return null;
                }

                const optionCenterX = rect.left + rect.width / 2;
                const yDistance = Math.abs(rect.top - controlRect.bottom);
                const xDistance = Math.abs(optionCenterX - controlCenterX);
                const abovePenalty = rect.bottom < controlRect.top ? 500 : 0;
                const farBelowPenalty = rect.top - controlRect.bottom > 420 ? 300 : 0;
                const score = yDistance + xDistance * 0.3 + abovePenalty + farBelowPenalty;

                return {
                    element,
                    score
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.score - b.score)[0]?.element || null;
    }

    function findDropdownOption(optionText, control, field) {
        const expected = normalizeText(optionText);
        const controlRect = getElementRect(control);
        const controlCenterX = controlRect ? controlRect.left + controlRect.width / 2 : 0;
        const elements = Array.from(document.querySelectorAll('button, div, span, li, p'));

        return elements
            .map((element) => {
                if (!isVisible(element)) {
                    return null;
                }

                const value = normalizeText(element.textContent);
                const classChain = getClassChain(element, 8);
                const canContainSelectOptions = /bcc-select|select|dropdown|menu|popover|popper/.test(classChain);
                let candidateElement = element;

                if (value !== expected) {
                    if (!canContainSelectOptions || !value.includes(expected) || value.length > 500) {
                        return null;
                    }

                    candidateElement = findChildTextElement(element, expected) || element;
                }

                if (normalizeText(candidateElement.textContent) !== expected && !canContainSelectOptions) {
                    return null;
                }
                if (value === expected && value.length > 60) {
                    return null;
                }
                if (candidateElement === element && Array.from(element.children).some((child) => normalizeText(child.textContent) === expected)) {
                    return null;
                }
                if (field !== 'tags' && isInUploadTagArea(element)) {
                    return null;
                }

                const rect = getElementRect(candidateElement);
                if (!rect) {
                    return null;
                }
                if ((field === 'category' || field === 'declaration') && controlRect) {
                    const isInsideControl = rect.top >= controlRect.top - 2 &&
                        rect.bottom <= controlRect.bottom + 2 &&
                        rect.left >= controlRect.left - 2 &&
                        rect.right <= controlRect.right + 2;
                    if (isInsideControl) {
                        return null;
                    }

                    const horizontalLimit = Math.max(controlRect.width, 260);
                    const optionCenterX = rect.left + rect.width / 2;
                    if (Math.abs(optionCenterX - controlCenterX) > horizontalLimit) {
                        return null;
                    }
                }

                const excludedClass = /label-item|topic|tag|recommend/.test(classChain);
                if ((field === 'category' || field === 'declaration') && excludedClass) {
                    return null;
                }
                const optionLikeBonus = /option|dropdown|select|menu|cascader|popover|popper/.test(classChain) ? -300 : 0;
                const belowControlBonus = controlRect && rect.top >= controlRect.top - 40 ? -80 : 0;
                const yDistance = controlRect ? Math.abs(rect.top - controlRect.bottom) : rect.top;
                const xDistance = controlRect ? Math.abs((rect.left + rect.width / 2) - controlCenterX) : 0;
                const pageBodyPenalty = classChain.includes('upload') && !/option|dropdown|select|menu|cascader|popover|popper/.test(classChain) ? 200 : 0;
                const score = yDistance + xDistance * 0.15 + optionLikeBonus + belowControlBonus + pageBodyPenalty;

                return {
                    element: candidateElement,
                    score
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.score - b.score)[0]?.element || null;
    }

    function fillTitle(title) {
        const value = normalizeText(title);
        if (!value) {
            return {
                field: 'title',
                success: false,
                message: '标题为空，请先确认标题预览'
            };
        }

        const titleInput = findTitleInput();
        if (!titleInput) {
            return {
                field: 'title',
                success: false,
                message: '未找到标题输入框，请手动填写'
            };
        }

        titleInput.focus();
        setNativeValue(titleInput, value);
        dispatchInputEvents(titleInput);

        return {
            field: 'title',
            success: true,
            message: '已填写标题'
        };
    }

    async function selectFieldOption(labelText, optionText, field, successMessage) {
        const container = getFieldContainer(labelText);
        if (!container) {
            return {
                field,
                success: false,
                message: `未找到${labelText}控件，请手动选择`
            };
        }

        let control = findClickableControl(container, labelText);
        if (!control) {
            return {
                field,
                success: false,
                message: `未找到${labelText}下拉控件，请手动选择`
            };
        }

        const alreadyShowsOption = field === 'declaration'
            ? getSelectDisplayText(control).includes(optionText)
            : getControlText(control).includes(optionText);
        if (alreadyShowsOption && field !== 'declaration') {
            return {
                field,
                success: true,
                message: successMessage
            };
        }

        const option = await openDropdownAndFindOption(control, optionText, field);
        if (!option) {
            if (field === 'declaration' && optionText === '内容无需标注') {
                const selectedByKeyboard = await selectDropdownFirstOptionByKeyboard(control, optionText);
                const selectedFirstOption = selectedByKeyboard || await selectFirstDropdownOption(control);
                dispatchSelectionCommitEvents(control);

                const fallbackControl = findClickableControl(getFieldContainer(labelText) || container, labelText) || control;
                if (selectedByKeyboard || selectedFirstOption || getSelectDisplayText(fallbackControl).includes(optionText) || isBccOptionSelected(fallbackControl, optionText)) {
                    return {
                        field,
                        success: true,
                        message: successMessage
                    };
                }

                return {
                    field,
                    success: false,
                    message: `${labelText}已尝试选择第一项：${optionText}，请手动检查`,
                    debug: getFieldDebug(labelText, optionText, fallbackControl, null)
                };
            }

            return {
                field,
                success: false,
                message: `未找到${labelText}选项：${optionText}，请手动选择`,
                debug: getFieldDebug(labelText, optionText, control, null)
            };
        }

        await clickOptionElement(option, optionText);
        await delay(250);
        if (field === 'declaration') {
            dispatchSelectionCommitEvents(control);
            await delay(120);
        }

        const nextContainer = getFieldContainer(labelText) || container;
        const nextControl = findClickableControl(nextContainer, labelText) || control;
        const confirmedText = field === 'declaration'
            ? getSelectDisplayText(nextControl)
            : getControlText(nextControl);
        const isConfirmed = confirmedText.includes(optionText) ||
            (field === 'declaration' && isBccOptionSelected(nextControl, optionText));
        if (!isConfirmed) {
            return {
                field,
                success: false,
                message: `${labelText}未确认选中：${optionText}，请手动检查`,
                debug: getFieldDebug(labelText, optionText, nextControl, option)
            };
        }

        return {
            field,
            success: true,
            message: successMessage
        };
    }

    function findTagInput() {
        const container = getFieldContainer('标签') || document;
        const inputs = Array.from(container.querySelectorAll('input, textarea'))
            .filter((element) => {
                if (!isVisible(element) || element.disabled || element.readOnly) {
                    return false;
                }

                const attrs = normalizeText([
                    element.getAttribute('placeholder'),
                    element.getAttribute('aria-label'),
                    element.getAttribute('title')
                ].filter(Boolean).join(' '));
                const context = getFieldContextText(element);
                return attrs.includes('标签') || attrs.includes('Enter') || context.includes('标签');
            });

        return inputs[0] || null;
    }

    function getTagInputContainer(tagInput) {
        let current = tagInput;
        for (let i = 0; i < 5 && current; i++) {
            const text = normalizeText(current.textContent);
            if (text.includes('还可以添加') || text.includes('按回车') || text.includes('标签')) {
                return current;
            }
            current = current.parentElement;
        }
        return tagInput.parentElement || document;
    }

    function clearTagInput(tagInput) {
        setNativeValue(tagInput, '');
        tagInput.dispatchEvent(new Event('input', { bubbles: true }));
        tagInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function getTagNameFromText(text) {
        return normalizeText(text).replace(/[×xX]\s*$/g, '').trim();
    }

    function getExistingTagChips(tagContainer) {
        const seen = new Set();
        return Array.from(tagContainer.querySelectorAll('button, div, span'))
            .map((element) => {
                if (!isVisible(element)) {
                    return null;
                }

                const rawText = normalizeText(element.textContent);
                const tagName = getTagNameFromText(rawText);
                const classChain = getClassChain(element, 4);

                if (!tagName || tagName.length > 12) {
                    return null;
                }
                if (tagName.includes('标签') || tagName.includes('回车') || tagName.includes('添加')) {
                    return null;
                }
                if (!rawText.includes('×') && !/tag|chip|label/.test(classChain)) {
                    return null;
                }

                const key = `${tagName}-${Math.round(element.getBoundingClientRect().left)}-${Math.round(element.getBoundingClientRect().top)}`;
                if (seen.has(key)) {
                    return null;
                }
                seen.add(key);

                return {
                    element,
                    tagName
                };
            })
            .filter(Boolean)
            .filter((item, index, items) => {
                return !items.some((other, otherIndex) => {
                    return otherIndex !== index &&
                        other.tagName === item.tagName &&
                        other.element.contains(item.element);
                });
            });
    }

    function findTagRemoveControl(chip) {
        const closeControl = Array.from(chip.querySelectorAll('button, i, svg, span'))
            .find((element) => {
                if (!isVisible(element)) {
                    return false;
                }

                const text = normalizeText(element.textContent);
                const className = String(element.className || '').toLowerCase();
                return text === '×' ||
                    className.includes('close') ||
                    className.includes('delete') ||
                    className.includes('remove');
            });

        return closeControl || chip;
    }

    async function removeUnexpectedTags(tagContainer, desiredTags) {
        const desiredSet = new Set(desiredTags);
        const chips = getExistingTagChips(tagContainer);
        const unexpectedChips = chips.filter((chip) => !desiredSet.has(chip.tagName));

        for (const chip of unexpectedChips) {
            clickElement(findTagRemoveControl(chip.element));
            await delay(120);
        }
    }

    async function setTags(tags) {
        const desiredTags = (tags || []).map(normalizeText).filter(Boolean);
        if (desiredTags.length === 0) {
            return {
                field: 'tags',
                success: true,
                message: '无需设置标签'
            };
        }

        const tagInput = findTagInput();
        if (!tagInput) {
            return {
                field: 'tags',
                success: false,
                message: '未找到标签输入框，请手动填写'
            };
        }

        const tagContainer = getTagInputContainer(tagInput);
        await removeUnexpectedTags(tagContainer, desiredTags);
        const existingText = normalizeText(tagContainer.textContent);
        const missingTags = desiredTags.filter((tag) => !existingText.includes(tag));

        if (missingTags.length === 0) {
            clearTagInput(tagInput);
            return {
                field: 'tags',
                success: true,
                message: `已设置标签：${desiredTags.join('、')}`
            };
        }

        for (const tag of missingTags) {
            tagInput.focus();
            setNativeValue(tagInput, tag);
            tagInput.dispatchEvent(new Event('input', { bubbles: true }));
            tagInput.dispatchEvent(new KeyboardEvent('keydown', {
                bubbles: true,
                cancelable: true,
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13
            }));
            tagInput.dispatchEvent(new KeyboardEvent('keyup', {
                bubbles: true,
                cancelable: true,
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13
            }));
            await delay(180);
            clearTagInput(tagInput);
        }

        tagInput.blur();

        return {
            field: 'tags',
            success: true,
            message: `已设置标签：${desiredTags.join('、')}`
        };
    }

    function getFileInputContext(element) {
        let current = element;
        const parts = [];

        for (let i = 0; i < 8 && current; i++) {
            parts.push(normalizeText([
                current.textContent,
                current.className,
                current.id,
                current.getAttribute?.('aria-label'),
                current.getAttribute?.('title')
            ].filter(Boolean).join(' ')));
            current = current.parentElement;
        }

        return parts.join(' ').slice(0, 800);
    }

    function scoreCoverFileInput(input) {
        const accept = String(input.getAttribute('accept') || '').toLowerCase();
        const attrs = normalizeText([
            input.getAttribute('name'),
            input.getAttribute('id'),
            input.getAttribute('class'),
            input.getAttribute('aria-label'),
            input.getAttribute('title')
        ].filter(Boolean).join(' ')).toLowerCase();
        const context = getFileInputContext(input);
        const contextLower = context.toLowerCase();

        let score = 0;
        if (accept.includes('image')) {
            score += 8;
        }
        if (/\.(jpg|jpeg|png|webp)/.test(accept)) {
            score += 4;
        }
        if (accept.includes('video') || accept.includes('audio')) {
            score -= 10;
        }
        if (attrs.includes('cover') || attrs.includes('poster') || attrs.includes('thumbnail')) {
            score += 8;
        }
        if (context.includes('封面') || context.includes('上传封面') || context.includes('更换封面')) {
            score += 10;
        }
        if (contextLower.includes('cover') || contextLower.includes('poster') || contextLower.includes('thumbnail')) {
            score += 6;
        }

        return score;
    }

    function findCoverFileInput() {
        const inputs = Array.from(document.querySelectorAll('input[type="file"]'))
            .map((input) => ({
                input,
                score: scoreCoverFileInput(input)
            }))
            .filter((item) => !item.input.disabled && item.score > 0)
            .sort((a, b) => b.score - a.score);

        return inputs[0]?.input || null;
    }

    function findCoverEntryButton() {
        const keywords = ['上传封面', '更换封面', '修改封面', '选择封面', '封面设置', '封面'];
        const attrPattern = /cover|poster|thumbnail|thumb|pic|image|crop|封面/i;
        const elements = Array.from(document.querySelectorAll('button, div, span, a, img, canvas, label, [role="button"], [class*="cover"], [class*="Cover"], [id*="cover"], [id*="Cover"]'))
            .map((element) => {
                if (!isVisible(element)) {
                    return null;
                }

                const text = normalizeText(element.textContent);
                const attrs = normalizeText([
                    element.getAttribute('aria-label'),
                    element.getAttribute('title'),
                    element.getAttribute('alt'),
                    element.getAttribute('src'),
                    element.getAttribute('style'),
                    element.className,
                    element.id
                ].filter(Boolean).join(' '));
                const haystack = `${text} ${attrs}`;
                if (!keywords.some((keyword) => haystack.includes(keyword)) && !attrPattern.test(haystack)) {
                    return null;
                }

                const rect = getElementRect(element);
                if (!rect || rect.width < 20 || rect.height < 18) {
                    return null;
                }

                const classChain = getClassChain(element, 6);
                const clickableBonus = /button|btn|upload|cover|empty|setting/.test(classChain) ? -140 : 0;
                const attrCoverBonus = attrPattern.test(attrs) ? -180 : 0;
                const exactBonus = ['上传封面', '更换封面', '修改封面', '选择封面', '封面设置'].includes(text) ? -320 : 0;
                const shortTextBonus = text.length > 0 && text.length <= 16 ? -80 : 0;
                const mediaBonus = ['IMG', 'CANVAS', 'LABEL'].includes(element.tagName) ? -60 : 0;
                const area = rect.width * rect.height;
                const hugePenalty = area > 160000 ? 420 : 0;
                const coverSettingSizeBonus = text === '封面设置' && area < 40000 ? -260 : 0;
                const score = rect.top + area * 0.002 + clickableBonus + attrCoverBonus + exactBonus + shortTextBonus + mediaBonus + coverSettingSizeBonus + hugePenalty;

                return {
                    element,
                    score
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.score - b.score);

        return elements[0]?.element || null;
    }

    function getCoverEntryClickTargets(element) {
        const targets = [];
        if (!element) {
            return targets;
        }

        targets.push(element);
        let current = element.parentElement;
        for (let i = 0; i < 5 && current; i++) {
            const className = String(current.className || '').toLowerCase();
            const role = current.getAttribute('role');
            const style = window.getComputedStyle(current);
            if (
                role === 'button' ||
                current.tagName === 'BUTTON' ||
                current.tagName === 'LABEL' ||
                style.cursor === 'pointer' ||
                /cover|poster|thumbnail|upload|button|btn|pic|image|crop/.test(className)
            ) {
                targets.push(current);
            }
            current = current.parentElement;
        }

        return targets.filter((target, index, list) => {
            return target && isVisible(target) && list.indexOf(target) === index;
        });
    }

    function getVisibleCoverAreas() {
        return Array.from(document.querySelectorAll('.cover-img, .cover-item, .cover-empty, .cover-main, [class*="cover"], [class*="Cover"]'))
            .filter(isVisible)
            .sort((a, b) => {
                const aText = normalizeText(a.textContent);
                const bText = normalizeText(b.textContent);
                const aRect = a.getBoundingClientRect();
                const bRect = b.getBoundingClientRect();
                const aExact = aText === '封面设置' ? -1000 : 0;
                const bExact = bText === '封面设置' ? -1000 : 0;
                const aAreaPenalty = aRect.width * aRect.height * 0.001;
                const bAreaPenalty = bRect.width * bRect.height * 0.001;
                return (aRect.top + aAreaPenalty + aExact) - (bRect.top + bAreaPenalty + bExact);
            })
            .slice(0, 8);
    }

    function findLocalCoverUploadEntry() {
        const keywords = ['本地上传', '上传图片', '上传封面', '选择图片', '选择封面', '自定义封面'];
        const elements = Array.from(document.querySelectorAll('button, div, span, a, label, [role="button"]'))
            .map((element) => {
                if (!isVisible(element)) {
                    return null;
                }

                const text = normalizeText(element.textContent);
                const attrs = normalizeText([
                    element.getAttribute('aria-label'),
                    element.getAttribute('title'),
                    element.className,
                    element.id
                ].filter(Boolean).join(' '));
                const haystack = `${text} ${attrs}`;
                if (!keywords.some((keyword) => haystack.includes(keyword))) {
                    return null;
                }

                const rect = getElementRect(element);
                if (!rect) {
                    return null;
                }

                const exactBonus = keywords.includes(text) ? -260 : 0;
                const modalBonus = /封面|裁剪|上传|cover|crop/i.test(getAncestorText(element, 8)) ? -160 : 0;
                const score = rect.top + rect.width * rect.height * 0.001 + exactBonus + modalBonus;
                return {
                    element,
                    score
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.score - b.score);

        return elements[0]?.element || null;
    }

    async function revealCoverFileInput() {
        let input = findCoverFileInput();
        if (input) {
            return input;
        }

        const entryButton = findCoverEntryButton();
        const targets = [
            ...getCoverEntryClickTargets(getClickableOptionElement(entryButton)),
            ...getVisibleCoverAreas()
        ].filter((target, index, list) => {
            return target && isVisible(target) && list.indexOf(target) === index;
        });

        for (const target of targets) {
            clickElement(target);
            input = await waitFor(findCoverFileInput, 700, 100);
            if (input) {
                return input;
            }

            const localUploadEntry = await waitFor(findLocalCoverUploadEntry, 900, 100);
            if (localUploadEntry) {
                clickElement(getClickableOptionElement(localUploadEntry));
                input = await waitFor(findCoverFileInput, 1200, 100);
                if (input) {
                    return input;
                }
            }
        }

        return findCoverFileInput();
    }

    function getCoverUploadDebug() {
        const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'))
            .slice(0, 8)
            .map((input) => {
                return `${getElementDescription(input)} accept="${input.getAttribute('accept') || ''}" score=${scoreCoverFileInput(input)}`;
            });
        const coverEntries = ['上传封面', '更换封面', '修改封面', '选择封面', '封面']
            .flatMap((keyword) => getVisibleExactTextDescriptions(keyword, 3));
        const coverHintElements = Array.from(document.querySelectorAll('[class*="cover"], [class*="Cover"], [id*="cover"], [id*="Cover"], img, canvas'))
            .filter((element) => {
                if (!isVisible(element)) {
                    return false;
                }

                const attrs = normalizeText([
                    element.className,
                    element.id,
                    element.getAttribute('alt'),
                    element.getAttribute('src'),
                    element.getAttribute('style')
                ].filter(Boolean).join(' '));
                return /cover|poster|thumbnail|thumb|pic|image|crop|blob:|封面/i.test(attrs);
            })
            .slice(0, 10)
            .map(getElementDescription);

        return [
            `文件上传控件：${fileInputs.join(' | ') || '无'}`,
            `封面入口文本：${coverEntries.join(' | ') || '无'}`,
            `封面候选元素：${coverHintElements.join(' | ') || '无'}`
        ];
    }

    function getCoverMimeType(filename, fallbackType) {
        const lowerName = String(filename || '').toLowerCase();
        if (lowerName.endsWith('.png')) {
            return 'image/png';
        }
        if (lowerName.endsWith('.webp')) {
            return 'image/webp';
        }
        return fallbackType || 'image/jpeg';
    }

    async function createCoverFile(cover) {
        const url = chrome.runtime.getURL(cover.path);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`无法读取封面资源：${cover.path}`);
        }

        const blob = await response.blob();
        const filename = cover.filename || cover.path.split('/').pop() || 'cover.jpg';
        return new File([blob], filename, {
            type: getCoverMimeType(filename, blob.type)
        });
    }

    function setFileInputFiles(input, file) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function findCoverConfirmButton() {
        const confirmTexts = ['完成', '确定', '确认', '保存'];
        const buttons = Array.from(document.querySelectorAll('button, div, span'))
            .map((element) => {
                if (!isVisible(element)) {
                    return null;
                }

                const text = normalizeText(element.textContent);
                if (!confirmTexts.includes(text)) {
                    return null;
                }

                const context = getAncestorText(element, 8);
                const rect = getElementRect(element);
                const modalBonus = /裁剪|封面|预览|cover|crop/i.test(context) ? -200 : 0;
                const bottomBonus = rect && rect.top > window.innerHeight * 0.35 ? -40 : 0;
                const score = (rect ? rect.top : 0) + modalBonus + bottomBonus;

                return {
                    element,
                    score
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.score - b.score);

        return buttons[0]?.element || null;
    }

    async function confirmCoverCropIfNeeded() {
        await delay(900);
        const button = findCoverConfirmButton();
        if (!button) {
            return false;
        }

        clickElement(getClickableOptionElement(button));
        await delay(450);
        return true;
    }

    async function uploadCover(cover) {
        if (!cover || !cover.path) {
            return {
                field: 'cover',
                success: true,
                message: '未配置封面，已跳过'
            };
        }

        const input = await revealCoverFileInput();
        if (!input) {
            return {
                field: 'cover',
                success: false,
                message: '未找到封面上传入口，请手动上传封面',
                debug: getCoverUploadDebug()
            };
        }

        try {
            const file = await createCoverFile(cover);
            setFileInputFiles(input, file);
            const confirmed = await confirmCoverCropIfNeeded();

            return {
                field: 'cover',
                success: true,
                message: confirmed ? '已上传封面并确认裁剪' : '已上传封面，请检查是否需要手动确认裁剪'
            };
        } catch (error) {
            return {
                field: 'cover',
                success: false,
                message: error && error.message ? error.message : '封面上传失败，请手动上传'
            };
        }
    }

    async function fillUploadForm(payload) {
        const results = [];
        const emitProgress = (step, message, lineType = 'notice-line') => {
            if (!payload?.runId || !chrome.runtime?.sendMessage) {
                return;
            }

            chrome.runtime.sendMessage({
                type: FILL_PROGRESS_MESSAGE_TYPE,
                runId: payload.runId,
                step,
                message,
                lineType
            }, () => {
                // Popup may close while the content script is still working.
                void chrome.runtime.lastError;
            });
        };

        const pushResult = (step, result) => {
            const existingIndex = results.findIndex((item) => item.field === result.field);
            if (existingIndex >= 0) {
                results[existingIndex] = result;
            } else {
                results.push(result);
            }
            emitProgress(step, result.message, result.success ? 'success-line' : 'warning-line');
        };

        emitProgress('title', '正在填写标题...', 'notice-line');
        pushResult('title', fillTitle(payload?.title));

        if (payload?.declaration) {
            emitProgress('declaration', '正在选择创作声明...', 'notice-line');
            pushResult('declaration', await selectFieldOption(
                '创作声明',
                payload.declaration,
                'declaration',
                `已选择创作声明：${payload.declaration}`
            ));
        }

        if (payload?.category) {
            emitProgress('category', '正在选择分区...', 'notice-line');
            pushResult('category', await selectFieldOption(
                '分区',
                payload.category,
                'category',
                `已选择分区：${payload.category}`
            ));
        }

        if (payload?.tags) {
            emitProgress('tags', '正在设置标签...', 'notice-line');
            pushResult('tags', await setTags(payload.tags));
        }

        if (payload?.cover) {
            emitProgress('cover', '正在上传封面...', 'notice-line');
            pushResult('cover', await uploadCover(payload.cover));
        }

        return {
            success: results.every((result) => result.success),
            results
        };
    }

    if (!window.__bilibiliFitnessTitleHelperInjected) {
        window.__bilibiliFitnessTitleHelperInjected = true;

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (!message || !message.type) {
                sendResponse({
                    success: false,
                    message: '消息格式无效'
                });
                return;
            }

            try {
                if (message.type === DETECT_MESSAGE_TYPE) {
                    const candidates = collectCandidates();
                    if (candidates.length === 0) {
                        sendResponse({
                            success: false,
                            message: '未找到候选文本',
                            candidates: []
                        });
                        return;
                    }

                    sendResponse({
                        success: true,
                        candidates
                    });
                    return;
                }

                if (message.type === FILL_MESSAGE_TYPE) {
                    fillUploadForm(message.payload || {})
                        .then(sendResponse)
                        .catch((error) => {
                            sendResponse({
                                success: false,
                                message: error && error.message ? error.message : '投稿页填写失败',
                                results: []
                            });
                        });
                    return true;
                }

                sendResponse({
                    success: false,
                    message: `未知消息类型：${message.type}`
                });
            } catch (error) {
                sendResponse({
                    success: false,
                    message: error && error.message ? error.message : '投稿页脚本执行失败',
                    results: []
                });
            }
        });
    }
})();

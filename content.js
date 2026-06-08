(function() {
    const DETECT_MESSAGE_TYPE = 'GET_UPLOAD_TITLE_CANDIDATES';
    const FILL_MESSAGE_TYPE = 'FILL_UPLOAD_FORM';
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

    function getClickableOptionElement(element) {
        let current = element;
        for (let i = 0; i < 4 && current; i++) {
            const role = current.getAttribute('role');
            const tagName = current.tagName;
            const className = String(current.className || '').toLowerCase();
            if (
                tagName === 'LI' ||
                tagName === 'BUTTON' ||
                role === 'option' ||
                role === 'menuitem' ||
                className.includes('option') ||
                className.includes('select-option') ||
                className.includes('dropdown-item') ||
                className.includes('menu-item')
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

    async function clickOptionElement(option) {
        const clickableOption = getClickableOptionElement(option);
        clickElement(clickableOption);
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

        return [
            `控件：${getElementDescription(control)}`,
            `选项：${getElementDescription(option)}`,
            `可点目标：${openTargets.join(' | ') || '无'}`,
            `页面同名选项：${exactOptions.join(' | ') || '无'}`
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
            .filter((element) => {
                if (!isVisible(element)) {
                    return false;
                }

                const value = normalizeText(element.textContent).replace(/^\*\s*/, '');
                return value === expected || value.startsWith(`${expected} `);
            })
            .sort((a, b) => normalizeText(a.textContent).length - normalizeText(b.textContent).length)[0] || null;
    }

    function getFieldContainer(labelText) {
        const label = findLabelElement(labelText);
        let current = label;

        for (let i = 0; i < 5 && current; i++) {
            const text = normalizeText(current.textContent);
            const hasInputs = current.querySelector('input, textarea, [role="combobox"], [aria-haspopup], button');
            if (hasInputs && text.includes(labelText)) {
                return current;
            }
            current = current.parentElement;
        }

        return label ? label.parentElement : null;
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

    function getPrimaryDropdownTarget(control) {
        return getDropdownOpenTargets(control).find((target) => {
            const className = String(target.className || '').toLowerCase();
            return className.includes('bcc-select') && !className.includes('input-wrap');
        }) || control;
    }

    async function selectFirstDropdownOption(control) {
        const target = getPrimaryDropdownTarget(control);
        const rect = getElementRect(target);

        if (!rect) {
            return;
        }

        clickElementAt(target, {
            x: rect.right - Math.min(24, rect.width / 2),
            y: rect.top + rect.height / 2
        });
        await delay(220);

        clickPoint({
            x: rect.left + 36,
            y: rect.bottom + 24
        });
        await delay(220);
    }

    async function fillDeclarationInput(control, optionText) {
        const target = getPrimaryDropdownTarget(control);
        const input = target.querySelector?.('input') || control.querySelector?.('input') || control;

        if (!input || !isVisible(input)) {
            return false;
        }

        clickElement(target);
        await delay(120);
        input.focus();
        setNativeValue(input, optionText);
        input.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            data: optionText,
            inputType: 'insertText'
        }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await delay(120);
        dispatchKeyboardSelect(input, 'Enter', 'Enter', 13);
        await delay(220);

        return getControlText(input).includes(optionText) || getControlText(control).includes(optionText);
    }

    async function openDropdownAndFindOption(control, optionText, field) {
        const findOption = () => {
            return findDropdownOption(optionText, control, field) ||
                (field === 'declaration' ? findOptionNearControl(optionText, control) : null);
        };
        const initialOption = findOption();
        if (initialOption) {
            return initialOption;
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

            const option = await waitFor(findOption, 650);
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
        if (getControlText(control).includes(optionText)) {
            return {
                field,
                success: true,
                message: successMessage
            };
        }

        if (!control) {
            return {
                field,
                success: false,
                message: `未找到${labelText}下拉控件，请手动选择`
            };
        }

        const option = await openDropdownAndFindOption(control, optionText, field);
        if (!option) {
            if (field === 'declaration' && optionText === '内容无需标注') {
                await selectFirstDropdownOption(control);

                const fallbackControl = findClickableControl(getFieldContainer(labelText) || container, labelText) || control;
                if (getControlText(fallbackControl).includes(optionText)) {
                    return {
                        field,
                        success: true,
                        message: successMessage
                    };
                }

                const inputFallbackSuccess = await fillDeclarationInput(fallbackControl, optionText);
                if (inputFallbackSuccess) {
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

        await clickOptionElement(option);
        await delay(250);

        const nextContainer = getFieldContainer(labelText) || container;
        const nextControl = findClickableControl(nextContainer, labelText) || control;
        if (!getControlText(nextControl).includes(optionText)) {
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

    async function fillUploadForm(payload) {
        const results = [
            fillTitle(payload?.title)
        ];

        if (payload?.declaration) {
            results.push(await selectFieldOption(
                '创作声明',
                payload.declaration,
                'declaration',
                `已选择创作声明：${payload.declaration}`
            ));
        }

        if (payload?.category) {
            results.push(await selectFieldOption(
                '分区',
                payload.category,
                'category',
                `已选择分区：${payload.category}`
            ));
        }

        if (payload?.tags) {
            results.push(await setTags(payload.tags));
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

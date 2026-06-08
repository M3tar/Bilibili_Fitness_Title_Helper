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

    function fillUploadForm(payload) {
        const results = [
            fillTitle(payload?.title)
        ];

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
                    sendResponse(fillUploadForm(message.payload || {}));
                    return;
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

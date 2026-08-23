// Shared Bootstrap enhancement for server-rendered views. Existing IDs, names,
// values, and event hooks remain untouched; only presentation classes are added.
function applyBootstrapPresentation(root = document) {
    root.querySelectorAll('form').forEach(form => {
        form.classList.add('bootstrap-form');
    });

    root.querySelectorAll('input').forEach(input => {
        const type = String(input.type || 'text').toLowerCase();
        const excludedTypes = new Set(['hidden', 'radio', 'checkbox', 'button', 'submit', 'reset']);
        if (!excludedTypes.has(type) && !input.classList.contains('qty-input')) {
            input.classList.add('form-control');
        }
    });

    root.querySelectorAll('textarea').forEach(textarea => {
        textarea.classList.add('form-control');
    });

    root.querySelectorAll('select').forEach(select => {
        select.classList.add('form-select');
    });

    root.querySelectorAll('.form-group > label').forEach(label => {
        label.classList.add('form-label');
    });

    root.querySelectorAll('table').forEach(table => {
        table.classList.add('table', 'align-middle');
        if (table.classList.contains('data-table')) {
            table.classList.add('table-hover', 'mb-0');
        }
    });

    root.querySelectorAll('.data-table-wrapper').forEach(wrapper => {
        wrapper.classList.add('table-responsive');
    });

    root.querySelectorAll('.toolbar').forEach(toolbar => {
        toolbar.classList.add('flex-wrap', 'gap-2');
    });
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        applyBootstrapPresentation(document);
        console.log('Virtual Try-On App Loaded with Bootstrap.');
    });
}

if (typeof module === 'object' && module.exports) {
    module.exports = { applyBootstrapPresentation };
}

"use strict";
/// <reference types="chrome" />
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
var Path;
(function (Path) {
    Path["popup_sync"] = "common/html/popup-sync.html";
    Path["style_popup"] = "common/css/popup-sync.css";
})(Path || (Path = {}));
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'IMPORT_BACKUP') {
        const data = message.data;
        Object.entries(data).forEach(([key, value]) => {
            localStorage.setItem(key, String(value));
        });
        sendResponse({ success: true, count: Object.keys(data).length });
    }
});
(async () => {
    console.log('🔍 === VÉRIFICATION DU STORAGE DE L\'EXTENSION ===');
    try {
        const allStorage = await browserAPI.storage.local.get(null);
        console.log('📦 Contenu complet du storage:', allStorage);
        console.log('📊 Nombre de clés totales:', Object.keys(allStorage).length);
    }
    catch (error) {
        console.error('❌ Erreur lors de la lecture du storage:', error);
    }
    console.log('🔍 === FIN VÉRIFICATION STORAGE ===\n');
    if (!window.location.href.match(/^https:\/\/anime-sama.*/)) {
        console.log("no AnimeSama website");
        //return;
    }
    const hostname = window.location.hostname;
    console.log('🎯 Anime-sama détecté:', hostname);
    // === SERVICE 1 : LECTURE ===
    const readAllLocalStorage = () => {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                data[key] = localStorage.getItem(key) ?? '';
            }
        }
        return data;
    };
    // === SERVICE 2 : SAUVEGARDE ===
    const saveToExtension = async (data) => {
        const storageKey = `${hostname}`;
        const backup = {
            hostname,
            data,
            timestamp: Date.now()
        };
        await browserAPI.storage.local.set({ [storageKey]: backup });
        console.log('💾 SAUVEGARDÉ:', Object.keys(data).length, 'clés');
    };
    // === SERVICE 3 : POPUP CONFIRMATION ===
    const showSyncPopup = async () => {
        // Injecter CSS
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = browserAPI.runtime.getURL(Path.style_popup);
        document.head.appendChild(css);
        // Injecter HTML popup
        const popup = document.createElement('div');
        const response = await fetch(browserAPI.runtime.getURL(Path.popup_sync));
        popup.innerHTML = await response.text();
        document.body.appendChild(popup);
        const hostnameText = popup.querySelector('strong');
        if (hostnameText && hostnameText.textContent) {
            hostnameText.textContent = hostname;
        }
        // Récupérer données depuis extension
        const stored = await browserAPI.storage.local.get(null);
        console.log(stored);
        const availableBackups = Object.keys(stored)
            .filter(key => key.startsWith('anime-sama'))
            .map(key => stored[key]);
        const select = popup.querySelector('#backup-select');
        availableBackups.length > 0 ? select.innerHTML = '' : null;
        availableBackups.forEach((backup) => {
            const option = document.createElement('option');
            option.value = backup.hostname;
            option.textContent = `📺 ${backup.hostname} (${new Date(backup.timestamp).toLocaleString()})`;
            select.appendChild(option);
        });
        // Event listeners
        popup.querySelector('#sync-btn').onclick = async () => {
            const selectedHostname = select.value;
            if (selectedHostname) {
                const backupData = stored[`${selectedHostname}`].data;
                Object.entries(backupData).forEach(([key, value]) => {
                    localStorage.setItem(key, value);
                });
                popup.remove();
                console.log('✅ SYNC terminé depuis', selectedHostname);
                location.reload();
            }
        };
        popup.querySelector('#cancel-btn').onclick = () => {
            popup.remove();
        };
    };
    // === LOGIQUE PRINCIPALE ===
    const currentData = readAllLocalStorage();
    if (Object.keys(currentData).length > 0) {
        // CAS 1 : Données présentes → SAUVEGARDER
        await saveToExtension(currentData);
    }
    else {
        // CAS 2 : VIDE → POPUP
        console.log('📭 LocalStorage vide → Popup sync');
        await showSyncPopup();
    }
})();

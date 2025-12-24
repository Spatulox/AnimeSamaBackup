/// <reference types="chrome" />

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

type AnimeSamaHistory = Record<string, any>;

interface AnimeBackup {
    hostname: string;
    data: AnimeSamaHistory;
    timestamp: number;
}

enum Path {
    popup_sync = "common/html/popup-sync.html",
    style_popup = "common/css/popup-sync.css"
}

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'IMPORT_BACKUP') {
        const data: AnimeSamaHistory = message.data;
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
    } catch (error) {
        console.error('❌ Erreur lors de la lecture du storage:', error);
    }
    console.log('🔍 === FIN VÉRIFICATION STORAGE ===\n');


    if (!window.location.href.match(/^https:\/\/anime-sama.*/)) {
        console.log("no AnimeSama website");
        //return;
    }



    const hostname: string = window.location.hostname;
    console.log('🎯 Anime-sama détecté:', hostname);

    // === SERVICE 1 : LECTURE ===
    const readWebsiteLocalStorage = (): AnimeSamaHistory => {
        const data: AnimeSamaHistory = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                data[key] = localStorage.getItem(key) ?? '';
            }
        }
        return data;
    };

    async function getExtensionLocalStorage(): Promise<Record<string, AnimeBackup | undefined>> {
        return await browserAPI.storage.local.get(null) as Record<string, AnimeBackup | undefined>;
    }

    // === SERVICE 2 : SAUVEGARDE ===
    const saveToExtension = async (data: AnimeSamaHistory): Promise<void> => {
        const storageKey = `${hostname}`;
        const backup: AnimeBackup = {
            hostname,
            data,
            timestamp: Date.now()
        };
        await browserAPI.storage.local.set({ [storageKey]: backup });
        console.log('💾 SAUVEGARDÉ:', Object.keys(data).length, 'clés');
    };

    // === SERVICE 3 : POPUP CONFIRMATION ===
    const showSyncPopup = async (): Promise<void> => {
        // Injecter CSS
        const css: HTMLLinkElement = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = browserAPI.runtime.getURL(Path.style_popup);
        document.head.appendChild(css);

        // Injecter HTML popup
        const popup: HTMLDivElement = document.createElement('div');

        const response = await fetch(browserAPI.runtime.getURL(Path.popup_sync));
        popup.innerHTML = await response.text();
        document.body.appendChild(popup);

        const hostnameText = popup.querySelector('strong');
        if (hostnameText && hostnameText.textContent) {
            hostnameText.textContent = hostname;
        }

        // Récupérer données depuis extension
        const stored = await getExtensionLocalStorage();
        console.log(stored);
        const availableBackups: AnimeBackup[] = Object.keys(stored)
            .filter(key => key.startsWith('anime-sama'))
            .map(key => stored[key]!)


        const select = popup.querySelector('#backup-select') as HTMLSelectElement;
        availableBackups.length > 0 ? select.innerHTML = '' : null
        availableBackups.forEach((backup: AnimeBackup) => {
            const option: HTMLOptionElement = document.createElement('option');
            option.value = backup.hostname;
            option.textContent = `📺 ${backup.hostname} (${new Date(backup.timestamp).toLocaleString()})`;
            select.appendChild(option);
        });

        // Event listeners
        (popup.querySelector('#sync-btn') as HTMLElement).onclick = async () => {
            const selectedHostname = select.value;
            if (selectedHostname) {
                const backupData: Record<string, string> = stored[`${selectedHostname}`]!.data;
                Object.entries(backupData).forEach(([key, value]) => {
                    localStorage.setItem(key, value);
                });
                popup.remove();
                console.log('✅ SYNC terminé depuis', selectedHostname);
                location.reload();
            }
        };

        (popup.querySelector('#cancel-btn') as HTMLElement).onclick = () => {
            popup.remove();
        };
    };

    // === LOGIQUE PRINCIPALE ===
    const currentData: AnimeSamaHistory = readWebsiteLocalStorage();
    const extensionData = await getExtensionLocalStorage()

    if (Object.keys(currentData).length > 0) {
        // CAS 1 : Données présentes → SAUVEGARDER
        await saveToExtension(currentData);
    } else {
        // CAS 2 : VIDE → POPUP
        console.log('📭 LocalStorage vide → Popup sync');
        if(Object.keys(extensionData).length > 0 ) {
            await showSyncPopup();
        }
    }
})();
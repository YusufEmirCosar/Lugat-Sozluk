document.addEventListener('DOMContentLoaded', async () => {
    const inputElement = document.getElementById('wordInput');

    try {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
            inputElement.focus();
            return;
        }

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection().toString().trim()
        }, (injectionResults) => {
            if (injectionResults && injectionResults[0] && injectionResults[0].result) {
                inputElement.value = injectionResults[0].result;
                document.getElementById('searchBtn').click();
            } else {
                inputElement.focus();
            }
        });
    } catch (err) {
        inputElement.focus();
    }
});

document.getElementById('searchBtn').addEventListener('click', async () => {
    const word = document.getElementById('wordInput').value.trim();
    const resultDiv = document.getElementById('result');
    
    if (!word) return;
    
    resultDiv.innerHTML = "<div style='text-align:center; padding: 20px; color:#666;'>Aranıyor...</div>";
    
    try {
        const targetUrl = `https://tureng.com/en/turkish-english/${encodeURIComponent(word)}`;
        const response = await fetch(targetUrl);
        if (!response.ok) throw new Error("Failed to fetch the page.");
        
        const htmlString = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        
        const allResultRows = doc.querySelectorAll('.searchResultsTable');
        if (allResultRows.length === 0) {
             resultDiv.innerHTML = "<div style='text-align:center; padding: 20px; color:#666;'>Translation not found. Check your spelling!</div>";
             return;
        }

        let translations = [];
        let currentLangPair = "";

        for (let i = 0; i < allResultRows.length; i++) {
            let table = allResultRows[i];
            
            let lang1Elem = table.querySelector('.c2');
            let lang2Elem = table.querySelector('.c3');
            
            if (!lang1Elem || !lang2Elem) continue; 
            
            let lang1 = lang1Elem.innerText.trim();
            let lang2 = lang2Elem.innerText.trim();
            let newLangPair = lang1 + "-" + lang2;

            if (newLangPair !== currentLangPair) {
                
                if (i > 0) {
                    translations.push('<div style="height: 20px;"></div>');
                }
                
                translations.push(`
                    <div class="trans-row header-row">
                        <div class="col-num">#</div>
                        <div class="col-type">Category</div>
                        <div class="col-tr">${lang1}</div>
                        <div class="col-en">${lang2}</div>
                    </div>
                `);
                
                translations.push('<div class="section-header">Meanings</div>');
                
                currentLangPair = newLangPair;
                
            } else {
                translations.push('<div class="section-header">Phrases</div>');
            }

            for (let row of table.getElementsByTagName('tr')) {
                if (row.className.includes("example-sentences-row") == false && row.className.includes("tureng-manual-stripe") == true) {
                    
                    let orderText = row.getElementsByTagName('td')[0].innerText.trim();
                    let type = row.getElementsByTagName('td')[1].innerText.trim();

                    let trCell = row.getElementsByTagName('td')[2];
                    let inputWordElement = trCell.querySelector('a');
                    let inputTypeElement = trCell.querySelector('i');

                    let inputWord = inputWordElement ? inputWordElement.innerText.trim() : trCell.innerText.trim();
                    let inputWordType = inputTypeElement ? inputTypeElement.innerText.trim() : "";

                    if (!inputWordElement && inputWordType) {
                        inputWord = inputWord.replace(inputWordType, '').trim();
                    }

                    let enCell = row.getElementsByTagName('td')[3];
                    let wordElement = enCell.querySelector('a');
                    let typeElement = enCell.querySelector('i');

                    let translatedWord = wordElement ? wordElement.innerText.trim() : enCell.innerText.trim();
                    let wordType = typeElement ? typeElement.innerText.trim() : "";

                    if (!wordElement && wordType) {
                        translatedWord = translatedWord.replace(wordType, '').trim();
                    }

                    let rowHTML = `
                        <div class="trans-row">
                            <div class="col-num">${orderText}</div>
                            <div class="col-type">${type}</div>
                            <div class="col-tr">
                                ${inputWord}
                                <span class="word-type">${inputWordType ? '(' + inputWordType + ')' : ''}</span>
                            </div>
                            <div class="col-en">
                                ${translatedWord} 
                                <span class="word-type">${wordType ? '(' + wordType + ')' : ''}</span>
                            </div>
                        </div>
                    `;
                    
                    translations.push(rowHTML);
                }
            }
        }
        
        if (translations.length > 0) { 
            resultDiv.innerHTML = translations.join('');
        } else {
            resultDiv.innerHTML = "<div style='text-align:center; padding: 20px; color:#666;'>Kelime bulunamadı</div>";
        }
        
    } catch (error) {
        resultDiv.innerHTML = `<div style='text-align:center; padding: 20px; color:red;'>Error: ${error.message}</div>`;
    }

    document.getElementById('wordInput').focus();
    document.getElementById('wordInput').select();
});

document.getElementById('wordInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        document.getElementById('searchBtn').click();
    }
});
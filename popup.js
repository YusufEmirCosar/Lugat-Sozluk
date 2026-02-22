// Run this immediately when the popup opens
document.addEventListener('DOMContentLoaded', async () => {
    const inputElement = document.getElementById('wordInput');

    try {
        // Find the browser tab you are currently looking at
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Chrome blocks scripts on special pages (like the New Tab page or settings)
        // If we are on one of those, just focus the input box and stop here.
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
            inputElement.focus();
            return;
        }

        // Inject a tiny script to ask the webpage: "Is any text highlighted?"
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection().toString().trim()
        }, (injectionResults) => {
            // Check if we got a result back
            if (injectionResults && injectionResults[0] && injectionResults[0].result) {
                // Yes! Text is highlighted. Put it in the box...
                inputElement.value = injectionResults[0].result;
                // ...and automatically click the search button!
                document.getElementById('searchBtn').click();
            } else {
                // No text highlighted. Just put the blinking cursor in the box.
                inputElement.focus();
            }
        });
    } catch (err) {
        // If anything goes wrong, default to focusing the input box
        inputElement.focus();
    }
});

document.getElementById('searchBtn').addEventListener('click', async () => {
    const word = document.getElementById('wordInput').value.trim();
    const resultDiv = document.getElementById('result');
    
    if (!word) return;
    
    resultDiv.innerHTML = "<div style='text-align:center; padding: 20px; color:#666;'>Searching...</div>";
    
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
        let currentLangPair = ""; // This keeps track of the language direction

        // Loop through EVERY table Tureng gives us
        for (let i = 0; i < allResultRows.length; i++) {
            let table = allResultRows[i];
            
            // Get the headers for THIS specific table
            let lang1Elem = table.querySelector('.c2');
            let lang2Elem = table.querySelector('.c3');
            
            // If the table doesn't have standard headers, skip it
            if (!lang1Elem || !lang2Elem) continue; 
            
            let lang1 = lang1Elem.innerText.trim();
            let lang2 = lang2Elem.innerText.trim();
            let newLangPair = lang1 + "-" + lang2;

            // Did the language direction change? (Or is it the very first table?)
            if (newLangPair !== currentLangPair) {
                
                // If this is the second language direction, add some empty space first
                if (i > 0) {
                    translations.push('<div style="height: 20px;"></div>');
                }
                
                // Insert the dark Header Row
                translations.push(`
                    <div class="trans-row header-row">
                        <div class="col-num">#</div>
                        <div class="col-type">Category</div>
                        <div class="col-tr">${lang1}</div>
                        <div class="col-en">${lang2}</div>
                    </div>
                `);
                
                translations.push('<div class="section-header">Meanings</div>');
                
                // Update our tracker
                currentLangPair = newLangPair;
                
            } else {
                // The language direction is the SAME as the previous table!
                // This means it is a Phrases / Idioms table.
                translations.push('<div class="section-header">Phrases</div>');
            }

            // Now loop through the rows of THIS table
            for (let row of table.getElementsByTagName('tr')) {
                // Filter for valid translation rows
                if (row.className.includes("example-sentences-row") == false && row.className.includes("tureng-manual-stripe") == true) {
                    
                    let orderText = row.getElementsByTagName('td')[0].innerText.trim();
                    let type = row.getElementsByTagName('td')[1].innerText.trim();

                    // Extract data for the INPUT cell (Column 3)
                    let trCell = row.getElementsByTagName('td')[2];
                    let inputWordElement = trCell.querySelector('a');
                    let inputTypeElement = trCell.querySelector('i');

                    let inputWord = inputWordElement ? inputWordElement.innerText.trim() : trCell.innerText.trim();
                    let inputWordType = inputTypeElement ? inputTypeElement.innerText.trim() : "";

                    if (!inputWordElement && inputWordType) {
                        inputWord = inputWord.replace(inputWordType, '').trim();
                    }

                    // Extract data for the ENGLISH cell (Column 4)
                    let enCell = row.getElementsByTagName('td')[3];
                    let wordElement = enCell.querySelector('a');
                    let typeElement = enCell.querySelector('i');

                    let translatedWord = wordElement ? wordElement.innerText.trim() : enCell.innerText.trim();
                    let wordType = typeElement ? typeElement.innerText.trim() : "";

                    if (!wordElement && wordType) {
                        translatedWord = translatedWord.replace(wordType, '').trim();
                    }

                    // Build the Table Row HTML
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
        
        // Render everything to the screen
        if (translations.length > 0) { 
            resultDiv.innerHTML = translations.join('');
        } else {
            resultDiv.innerHTML = "<div style='text-align:center; padding: 20px; color:#666;'>Translation not found. Check your spelling!</div>";
        }
        
    } catch (error) {
        resultDiv.innerHTML = `<div style='text-align:center; padding: 20px; color:red;'>Error: ${error.message}</div>`;
    }

    document.getElementById('wordInput').focus();
    document.getElementById('wordInput').select();
});

// Allow hitting "Enter" to trigger the search button
document.getElementById('wordInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        document.getElementById('searchBtn').click();
    }
});
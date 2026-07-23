import os
import re
import json
import random
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def clean_punctuation(text):
    # Remove all standard Chinese/English punctuation and spaces
    punctuation = r'[\s，。！？、；：""\'\'（）【】《》—～·\(\),.\!?_\=\-\+\*\/&%\$#@~`<>\{\}\[\]\\\|]'
    return re.sub(punctuation, '', text)

def get_level_label(level_no):
    # Map level_no to roman numerals I-V
    mapping = {
        1: "I",
        2: "II",
        3: "III",
        4: "IV",
        5: "V"
    }
    return mapping.get(level_no, str(level_no))

def download_data():
    base_url = "https://12basic.hakka.gov.tw/api/self_study/listening/categories"
    output_dir = r"D:\Yezi\G_project\S2_mission_game\Qiankun Great Shift_v2\data\quiz"
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # 6 dialects and 5 levels
    dialects = [1, 2, 3, 4, 5, 6]
    levels = [1, 2, 3, 4, 5]
    
    for dialect_id in dialects:
        for level_no in levels:
            print(f"Fetching Dialect {dialect_id}, Level {level_no}...")
            params = {
                "level_no": level_no,
                "dialect_id": dialect_id
            }
            try:
                response = requests.get(base_url, params=params, verify=False, timeout=15)
                if response.status_code != 200:
                    print(f"Failed to fetch. Status code: {response.status_code}")
                    continue
                
                data = response.json()
                categories_data = data.get("categories", {})
                
                # Normalize categories to a list
                if isinstance(categories_data, dict):
                    categories_list = list(categories_data.values())
                elif isinstance(categories_data, list):
                    categories_list = categories_data
                else:
                    categories_list = []
                
                questions = []
                
                for cat in categories_list:
                    cat_name = cat.get("name", "")
                    cat_id = cat.get("id", "0")
                    dialogs_data = cat.get("dialogs", {})
                    
                    if isinstance(dialogs_data, dict):
                        dialogs_list = list(dialogs_data.values())
                    elif isinstance(dialogs_data, list):
                        dialogs_list = dialogs_data
                    else:
                        dialogs_list = []
                        
                    for diag in dialogs_list:
                        sentences_data = diag.get("sentences", {})
                        
                        if isinstance(sentences_data, dict):
                            sentences_list = list(sentences_data.values())
                        elif isinstance(sentences_data, list):
                            sentences_list = sentences_data
                        else:
                            sentences_list = []
                            
                        for sent in sentences_list:
                            hakka_sec = sent.get("hakka_sentence", {})
                            chinese_sec = sent.get("chinese_sentence", {})
                            
                            hakka_text = hakka_sec.get("text", "") if hakka_sec else ""
                            chinese_text = chinese_sec.get("text", "") if chinese_sec else ""
                            
                            audio_sec = hakka_sec.get("audio", {}) if hakka_sec else {}
                            audio_url = audio_sec.get("url", "") if audio_sec else ""
                            
                            if not hakka_text or not audio_url:
                                continue
                                
                            sentence_id = sent.get("id", random.randint(1000, 9999))
                            
                            # Process Hakka characters list
                            clean_hakka = clean_punctuation(hakka_text)
                            correct_seq = list(clean_hakka)
                            
                            shuffled_blocks = list(correct_seq)
                            random.shuffle(shuffled_blocks)
                            
                            question_id = f"q_listening_d{dialect_id}_l{level_no}_c{cat_id}_{sentence_id}"
                            
                            q_obj = {
                                "question_id": question_id,
                                "level": get_level_label(level_no),
                                "dialect_id": dialect_id,
                                "category": cat_name,
                                "audio_url": audio_url,
                                "hakka_hanji": hakka_text,
                                "correct_sequence": correct_seq,
                                "shuffled_blocks": shuffled_blocks,
                                "chinese_sentence": chinese_text,
                                "hakka_char_count": len(correct_seq)
                            }
                            questions.append(q_obj)
                
                # Write to JSON file
                output_file = os.path.join(output_dir, f"questions_dialect_{dialect_id}_level_{level_no}.json")
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(questions, f, ensure_ascii=False, indent=2)
                
                print(f"Saved {len(questions)} questions to {output_file}")
                
            except Exception as e:
                print(f"Error occurred: {e}")

if __name__ == "__main__":
    download_data()

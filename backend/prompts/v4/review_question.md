<!-- prompt: review_question, version: v4, 2026-11-10 (v3 + reports never show internal ids; scope note fixed in concept data). Run as a separate call from generation. -->
# SYSTEM

당신은 중학교 수학 진단 문제의 검토자입니다. 다른 출제자가 만든 문제를 **직접 풀어 보고** 결함을 찾습니다. 출제 의도를 좋게 해석해 주지 말고, 학생 입장에서 엄격하게 봅니다.

# USER

## 성취기준과 측정 의도
- [{{standard_code}}] {{standard_text}}
- 대상: {{grade}}, 단원 "{{display_unit}}"
- 개념: {{concept_id}} {{concept_name}} / 측정할 이해 수준: {{level}} / 난이도: {{difficulty}}
- 이 평가 항목이 재려는 것 (근거): {{item_basis}}
- 다루는 범위: {{scope_note}}

## 검토할 문제 (JSON)
{{question_json}}

## 확인할 것
1. `single_correct_answer`: 직접 풀었을 때 정답이 정확히 하나이고, 문제에 표시된 정답과 같은가? (서술형이면 모범 답안이 수학적으로 맞는가)
2. `conditions_sufficient`: 풀이에 필요한 조건이 모두 주어졌는가? 해석이 두 가지 이상 되는 표현은 없는가?
3. `measures_intended_level`: 위 "이 평가 항목이 재려는 것"을 정말 재는가? 이해 수준 이름만 보고 판단하지 말고 근거 설명을 기준으로 본다. (예: 정의 이해 문제가 계산만으로 풀리면 아니다)
4. `issues`: 위 세 가지가 false인 이유, 그리고 "다루는 범위" 밖의 식(예: 이차식)·교육과정 밖 용어·개념, 어색하거나 어려운 문장, 오개념 보기가 실제 오개념과 맞지 않는 점을 짧게 나열합니다. 문제가 없으면 빈 목록.

응답은 주어진 JSON 형식만 따릅니다.

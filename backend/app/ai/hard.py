from dataclasses import dataclass


@dataclass(frozen=True)
class HardCondition:
    code: str
    text: str


HARD_CONDITIONS: dict[str, tuple[HardCondition, ...]] = {
    "정의 이해": (
        HardCondition(
            "definition-a",
            "정의의 조건을 하나하나 따져야 판단되는 경계 사례를 다룬다 "
            "(예: 참이 아닌 등식, 문자가 없는 등식, 양변이 같은 식)",
        ),
        HardCondition(
            "definition-b",
            "일상 언어나 표로 주어진 것을 식으로 바꿔 판단하게 한다",
        ),
    ),
    "성질 적용": (
        HardCondition(
            "application-a",
            "거꾸로 쓰게 한다: 결과가 주어지고 조건을 찾는다 "
            "(예: 해가 주어졌을 때 계수 구하기)",
        ),
        HardCondition(
            "application-b",
            "문장이나 상황으로 주어진 것을 식으로 바꾼 뒤 적용하게 한다",
        ),
        HardCondition(
            "application-c",
            "여러 풀이 단계 중 어느 단계에서 어떤 성질이 쓰였는지, "
            "또는 어느 단계가 틀렸는지 판단하게 한다",
        ),
    ),
    "오개념 판별": (
        HardCondition(
            "misconception-a",
            "오답 보기 4개가 모두 승인된 오개념 또는 그럴듯한 부분 참에서 나온다",
        ),
        HardCondition(
            "misconception-b",
            "다른 학생의 주장이나 풀이를 보고 옳고 그름을 판단하게 한다",
        ),
    ),
    "이유 설명": (
        HardCondition(
            "explanation-a",
            "특정 수가 아니라 모든 경우에 성립하는 이유를 설명하게 한다",
        ),
        HardCondition(
            "explanation-b",
            "반례를 들어 주장이 틀렸음을 보이게 한다",
        ),
        HardCondition(
            "explanation-c",
            "두 풀이 방법이 같은 결과를 내는 이유를 비교해 설명하게 한다",
        ),
    ),
}


def render_hard_conditions(level: str, difficulty: str) -> str:
    if level not in HARD_CONDITIONS:
        raise ValueError(f"Unknown level: {level}")
    if difficulty == "normal":
        return "   - (일반 문제: 해당 없음)"
    if difficulty != "hard":
        raise ValueError(f"Unknown difficulty: {difficulty}")
    lines = [
        f"   - `{condition.code}`: {condition.text}"
        for condition in HARD_CONDITIONS[level]
    ]
    return "\n".join(lines)

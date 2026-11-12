그림 데이터 형식 (`kind`로 종류를 고릅니다. 모든 필드를 쓰고, 쓰지 않는 값은 null로 둡니다)
- number_line(수직선): min, max(보이는 범위), tick_step(눈금 간격), label_step(눈금 숫자를 적는 간격), points[{x, label, filled}], rays[{from, direction("left"/"right"), closed}], segments[{from, to, from_closed, to_closed}]. filled와 closed는 true면 ●(그 수를 포함), false면 ○(포함하지 않음)으로 그려집니다. 점에 ●/○ 표시가 필요 없으면 filled는 null입니다. 반직선은 from에서 direction 쪽으로 끝없이 이어지는 굵은 선입니다.
- coordinate_plane(좌표평면): x_min, x_max, y_min, y_max, tick_step, show_tick_labels, points[{x, y, label}], graphs[{type:"linear", m, b, label}(y=mx+b) | {type:"vertical", c, label}(x=c) | {type:"quadratic", a, p, q, label}(y=a(x-p)^2+q)]. 원점이 보이게 범위를 잡습니다. 그래프는 보이는 범위에서 잘려 그려집니다.
- bar_chart(막대그래프): categories, values, y_max, y_step, x_label, y_label
- frequency(히스토그램·도수분포다각형): class_start(첫 계급의 시작), class_width, frequencies(계급별 도수, 음이 아닌 정수), show_bars(히스토그램), show_polygon(도수분포다각형), y_step, x_label, y_label
- boxplot(상자그림): axis_min, axis_max, axis_step, series[{label, min, q1, median, q3, max}] (1~3개, 가로 상자그림)
- scatter(산점도): x_min, x_max, x_step, y_min, y_max, y_step, x_label, y_label, points[{x, y}]
- 상한: 수직선 눈금 25개·점 8개·반직선과 선분 합계 3개, 좌표평면 축마다 눈금 25개·점 8개·그래프 3개, 막대와 계급 12개, 상자 3개, 산점도 점 40개.
- 그림 안의 글(label, 축 이름, 범주 이름)은 10자 이하의 일반 글입니다. KaTeX(`$`)와 `<`, `>`를 쓰지 않습니다. 쓰지 않는 글은 null입니다.

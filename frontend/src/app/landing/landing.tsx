import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import Hero from "./variants/hero";
import ReportPreview, { ConceptSummary } from "./report-preview";
import { reasons, steps } from "./landing-content";

export default function Landing() {
  return (
    <VStack as="main" className="landing" gap={10}>
      <Hero />

      <VStack gap={4}>
        <Heading level={2}>같은 시험, 다르게 보기</Heading>
        <Grid columns={{ minWidth: 280, max: 2 }} gap={4}>
          <Card>
            <VStack gap={3}>
              <Heading level={3}>점수로 보면</Heading>
              <Text type="display-2" weight="bold">
                70점
              </Text>
              <Grid columns={{ minWidth: 52, max: 5 }} gap={2}>
                {Array.from({ length: 10 }, (_, index) => (
                  <VStack key={index} gap={1} hAlign="center">
                    <Text type="supporting">{index + 1}번</Text>
                    <Text weight="bold">{index < 7 ? "✓ 맞음" : "✗ 틀림"}</Text>
                  </VStack>
                ))}
              </Grid>
              <Text as="p">
                몇 번을 틀렸는지는 알아도, 어떤 개념에서 막혔는지는 알 수
                없어요.
              </Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={3}>
              <Heading level={3}>개념으로 보면</Heading>
              <ConceptSummary />
            </VStack>
          </Card>
        </Grid>
      </VStack>

      <ReportPreview />

      <List
        listStyle="decimal"
        hasDividers
        header={<Heading level={2}>이렇게 진단해요</Heading>}
      >
        {steps.map(([title, description], index) => (
          <ListItem
            key={title}
            itemKey={index}
            label={<Heading level={3}>{title}</Heading>}
            description={<Text as="p">{description}</Text>}
            align="first-line"
          />
        ))}
      </List>

      <List
        listStyle="decimal"
        hasDividers
        header={<Heading level={2}>왜 개념을 확인해야 할까요?</Heading>}
      >
        {reasons.map(([title, description], index) => (
          <ListItem
            key={title}
            itemKey={index}
            label={<Heading level={3}>{title}</Heading>}
            description={<Text as="p">{description}</Text>}
            align="first-line"
          />
        ))}
      </List>
    </VStack>
  );
}

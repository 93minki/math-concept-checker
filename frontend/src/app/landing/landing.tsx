import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { List, ListItem } from "@astryxdesign/core/List";
import { Section } from "@astryxdesign/core/Section";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import ReportPreview, { ConceptSummary } from "./report-preview";
import { heroDescription, heroTitle, reasons, steps } from "./landing-content";

export default function Landing() {
  return (
    <VStack as="main" className="landing" gap={10}>
      <Section variant="muted" padding={8}>
        <VStack gap={3} hAlign="center">
          <Heading
            level={1}
            type="display-2"
            justify="center"
            textWrap="balance"
          >
            {heroTitle}
          </Heading>
          <Text as="p" type="large" justify="center" textWrap="pretty">
            {heroDescription}
          </Text>
        </VStack>
      </Section>

      <VStack gap={4}>
        <Heading level={2}>같은 시험, 다르게 보기</Heading>
        <Grid columns={{ minWidth: 280, max: 2 }} gap={4}>
          <Card>
            <VStack gap={3}>
              <Heading level={3}>점수로 보면</Heading>
              <Text type="display-2" weight="bold">
                70점
              </Text>
              <Text as="p">어디서 막혔는지는 알 수 없어요</Text>
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

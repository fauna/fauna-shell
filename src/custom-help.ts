import { Help, Interfaces } from "@oclif/core";

/**
 * This is here just so that we can place beta topics below non beta ones.  We extend the
 * the Help class from oclif/core and just override their sortedTopics() method.
 * https://github.com/oclif/core/blob/main/src/help/index.ts#L67
 */
export default class CustomHelp extends Help {
  override get sortedTopics(): Interfaces.Topic[] {
    let topics = this.config.topics.filter((topic: Interfaces.Topic) => {
      // it is assumed a topic has a child if it has children
      const hasChild = this.config.topics.some((subTopic) =>
        subTopic.name.includes(`${topic.name}:`)
      );
      return hasChild;
    });
    topics = topics.filter((t) => this.opts.all || !t.hidden);
    const betaTopics = topics.filter((t) =>
      t.description?.startsWith("[BETA]")
    );
    const nonBetaTopics = topics.filter(
      (t) => !t.description?.startsWith("[BETA]")
    );
    nonBetaTopics.sort((t1, t2) => t1.name.localeCompare(t2.name));

    const betaTopicsSorted = [];
    const projectTopic = betaTopics.find((t) => t.name === "project");
    if (projectTopic !== undefined) {
      betaTopicsSorted.push(projectTopic);
    }

    const environmentTopic = betaTopics.find((t) => t.name === "environment");
    if (environmentTopic !== undefined) {
      betaTopicsSorted.push(environmentTopic);
    }
    betaTopicsSorted.push(
      ...betaTopics.filter(
        (t) => t.name !== "project" && t.name !== "environment"
      )
    );

    return [...nonBetaTopics, ...betaTopicsSorted];
  }
}

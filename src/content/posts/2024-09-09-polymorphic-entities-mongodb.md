---
title: "Handling Polymorphic Entities in MongoDB"
date: "2024-09-09"
categories: [backend, oop, mongodb]
---

### Background

I was working on a project that involved building a decision-tree engine in Spring Boot backed by MongoDB. The tree is composed of different "node" types — `DecisionNode`, `Note`, `Option`, `MultipleChoiceOption`, and so on — that all inherit from a common `Node` base class. The challenge was getting MongoDB and the REST API layer to correctly persist and deserialize these polymorphic entities.

This post walks through the approach I used and the gotchas I ran into along the way.

### The Domain Model

The base class looks something like this:

```java
public abstract class Node {
    private String id;
    private String label;
    private NodeType type;
    private List<String> childIds;

    // constructors, getters, setters...
}
```

Where `NodeType` is an enum:

```java
public enum NodeType {
    DECISION,
    NOTE,
    OPTION,
    MULTIPLE_CHOICE
}
```

And the subtypes extend it:

```java
public class DecisionNode extends Node {
    private String question;
    private List<String> optionIds;

    public DecisionNode() {
        super();
        setType(NodeType.DECISION);
    }
}

public class Note extends Node {
    private String content;

    public Note() {
        super();
        setType(NodeType.NOTE);
    }
}

public class Option extends Node {
    private String value;
    private String nextNodeId;

    public Option() {
        super();
        setType(NodeType.OPTION);
    }
}

public class MultipleChoiceOption extends Node {
    private List<String> values;
    private Map<String, String> nextNodeMap;

    public MultipleChoiceOption() {
        super();
        setType(NodeType.DECISION);
    }
}
```

Notice that `MultipleChoiceOption` also maps to `NodeType.DECISION` — multiple subtypes can share the same discriminator value. This is an important detail that comes up later.

### How Spring Data MongoDB Handles This

Spring Data MongoDB automatically adds a `_class` field to every document. This field stores the fully qualified class name and is what MongoDB uses to pick the right subclass during deserialization. This works out of the box — no extra annotations are needed for the MongoDB side.

A saved document looks something like this in the collection:

```json
{
    "_id": "abc123",
    "_class": "com.example.nodes.DecisionNode",
    "label": "What is the issue?",
    "type": "DECISION",
    "question": "Select the type of issue you're experiencing",
    "childIds": ["opt1", "opt2", "opt3"],
    "optionIds": ["opt1", "opt2", "opt3"]
}
```

The `_class` field is what Spring Data MongoDB uses internally. You can customize it if you want shorter names using `@TypeAlias`:

```java
@TypeAlias("decision")
public class DecisionNode extends Node {
    // ...
}
```

But for most cases, the default behavior is fine.

### The Jackson Layer (REST API)

Where things get interesting is the REST API. When you expose these entities via a `@RestController`, Jackson needs to know how to serialize and deserialize the polymorphic types. This is where `@JsonTypeInfo` and `@JsonSubTypes` come in:

```java
@JsonTypeInfo(
    use = JsonTypeInfo.Id.NAME,
    include = JsonTypeInfo.As.EXISTING_PROPERTY,
    property = "type",
    visible = true
)
@JsonSubTypes({
    @JsonSubTypes.Type(value = DecisionNode.class, name = "DECISION"),
    @JsonSubTypes.Type(value = Note.class, name = "NOTE"),
    @JsonSubTypes.Type(value = Option.class, name = "OPTION"),
    @JsonSubTypes.Type(value = MultipleChoiceOption.class, name = "MULTIPLE_CHOICE")
})
public abstract class Node {
    private String id;
    private String label;
    private NodeType type;
    private List<String> childIds;
}
```

A few things to note here:

- `use = JsonTypeInfo.Id.NAME` tells Jackson to use a named identifier for the type.
- `include = JsonTypeInfo.As.EXISTING_PROPERTY` tells Jackson to use the existing `type` field in the JSON rather than adding a new one.
- `property = "type"` specifies which field to use as the discriminator.
- `visible = true` ensures the `type` field is still populated in the deserialized object.

### Subtypes Sharing a Discriminator Value

One challenge in my design was that `DecisionNode` and `MultipleChoiceOption` both had `NodeType.DECISION` as their type. Jackson's `@JsonSubTypes` maps each `name` to exactly one class, so you can't have two subtypes with the same discriminator name.

The solution was to give `MultipleChoiceOption` its own discriminator value:

```java
@JsonSubTypes({
    @JsonSubTypes.Type(value = DecisionNode.class, name = "DECISION"),
    @JsonSubTypes.Type(value = Note.class, name = "NOTE"),
    @JsonSubTypes.Type(value = Option.class, name = "OPTION"),
    @JsonSubTypes.Type(value = MultipleChoiceOption.class, name = "MULTIPLE_CHOICE")
})
```

And updating the enum and constructor accordingly:

```java
public class MultipleChoiceOption extends Node {
    public MultipleChoiceOption() {
        super();
        setType(NodeType.MULTIPLE_CHOICE);
    }
}
```

This way, each subtype has a unique discriminator value for Jackson, while Spring Data MongoDB continues to use `_class` independently.

### Repository Layer

The repository is straightforward thanks to Spring Data:

```java
public interface NodeRepository extends MongoRepository<Node, String> {
    List<Node> findByType(String type);
}
```

Because Spring Data MongoDB uses the `_class` field to resolve the correct subtype, queries against the `Node` collection will automatically return the right subclass instances. A `findAll()` call returns a mixed `List<Node>` with `DecisionNode`, `Note`, `Option`, etc. all correctly typed.

You can also query by the `type` field if you need to filter by node type:

```java
List<Node> decisions = nodeRepository.findByType("DECISION");
```

### Gotchas

A few things to watch out for:

- **Don't remove `_class`**: It might be tempting to clean up the MongoDB documents by suppressing the `_class` field, but Spring Data MongoDB needs it for polymorphic deserialization. If you remove it, you'll get `ClassCastException` or everything will come back as the base type.

- **`_class` stability**: If you rename or move a class, the `_class` values in existing documents will break. Using `@TypeAlias` can help decouple class names from storage, which adds stability if you refactor.

- **Adding new subtypes**: When you add a new subtype, you need to update the `@JsonSubTypes` annotation on the base class. If you forget, Jackson will fail to deserialize the new type from REST requests, even though MongoDB handles it fine via `_class`.

- **The `type` field vs `_class`**: These serve different purposes. The `type` field is your domain-level discriminator (used in business logic and exposed via the API). The `_class` field is Spring Data MongoDB's internal mechanism. They coexist without conflict.

### A Note on Composition

You might be thinking, "why not use composition instead of inheritance?" That's a valid approach, and for some designs it would be cleaner. But in this case, inheritance made sense because all node types genuinely share behavior and structure — they all have an `id`, `label`, `type`, and `childIds`. The subtype-specific fields represent extensions rather than unrelated data.

### Conclusion

The key takeaway is that Spring Data MongoDB and Jackson operate on two separate layers:

1. **Spring Data MongoDB** uses the `_class` field (or `@TypeAlias`) to handle polymorphic persistence. This is automatic and doesn't require Jackson annotations.
2. **Jackson** uses `@JsonTypeInfo` and `@JsonSubTypes` to handle polymorphic serialization for the REST API layer. This is where you control how the `type` discriminator maps to concrete classes.

Understanding this separation makes the whole setup much less confusing. Spring Data handles the database side, Jackson handles the API side, and they don't interfere with each other.

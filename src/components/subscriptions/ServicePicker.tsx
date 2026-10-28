import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Search } from "lucide-react-native";
import { searchServices, type Service } from "../../domain/catalog";
import { PRO_PLAN_ENABLED } from "../../domain/planMode";
import { categories, type Category } from "../../domain/models";
import { useTheme } from "../../theme/useTheme";
import { Button, Card, Chips, Field, Heading, Label } from "../ui/Primitives";
import { ServiceIcon } from "./ServiceIcon";

export function ServicePicker({
  selected,
  onSelect,
  presentation = "card",
  autoFocus = false,
}: {
  selected: string | null;
  presentation?: "card" | "sheet";
  autoFocus?: boolean;
  onSelect: (service: Service | null, customName?: string) => void;
}) {
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "All">("All");
  const [limit, setLimit] = useState(12);
  const matches = useMemo(
    () => searchServices(search, category, PRO_PLAN_ENABLED),
    [search, category],
  );
  const Container = presentation === "sheet" ? View : Card;
  return (
    <Container
      style={{ marginBottom: presentation === "card" ? 22 : 0, gap: 16 }}
    >
      {presentation === "card" && <Heading size={18}>Choose a service</Heading>}
      <Field
        autoFocus={autoFocus}
        label="Find a service"
        testID="service-search"
        leading={<Search size={17} color={colors.secondary} />}
        placeholder="Search services…"
        maxLength={80}
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          setLimit(12);
        }}
      />
      <Chips
        values={["All", ...categories]}
        selected={category}
        onChange={(value) => {
          setCategory(value);
          setLimit(12);
        }}
      />
      <Label
        size={11}
        color={colors.secondary}
        accessibilityLiveRegion="polite"
      >
        {matches.length} {matches.length === 1 ? "match" : "matches"}
        {matches.length > limit ? ` · showing ${limit}` : ""}
      </Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
        {matches.slice(0, limit).map((service) => (
          <Pressable
            key={service.id}
            testID={`service-choice-${service.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Select ${service.name}, ${service.category}`}
            accessibilityState={{ selected: selected === service.id }}
            onPress={() => onSelect(service)}
            style={({ pressed }) => ({
              minHeight: 48,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderWidth: 1,
              borderColor:
                selected === service.id ? colors.primary : colors.border,
              padding: 9,
              paddingRight: 14,
              borderRadius: 12,
              backgroundColor:
                selected === service.id || pressed
                  ? colors.mint
                  : colors.background,
            })}
          >
            <ServiceIcon serviceId={service.id} name={service.name} size={30} />
            <Label size={12}>{service.name}</Label>
          </Pressable>
        ))}
      </View>
      {!matches.length && (
        <Label color={colors.secondary} size={12}>
          No matching services. Add your own below.
        </Label>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {matches.length > limit && (
          <Button
            small
            variant="secondary"
            onPress={() => setLimit((value) => value + 18)}
          >
            Show more services
          </Button>
        )}
        <Button
          small
          variant="ghost"
          onPress={() => onSelect(null, search.trim())}
        >
          Use a custom service
        </Button>
      </View>
    </Container>
  );
}

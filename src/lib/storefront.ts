export type Condition = "new" | "used";

export type OptionValue = { id: string; label: string };

export type OptionGroup = {
  id: string;
  name: string;
  type: "select" | "radio" | "checkbox" | "text";
  required: boolean;
  values?: OptionValue[];
};

export type CatalogProduct = {
  id: string;
  title: string;
  brand: string;
  condition: Condition;
  optionGroups?: OptionGroup[];
  price: number;
  oldPrice: number | null;
  stock: number;
};

export type CartItem = { productId: string; qty: number };

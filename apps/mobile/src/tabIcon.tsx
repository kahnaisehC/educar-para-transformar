import { Text, type ColorValue } from "react-native";

export type TabIconProps = {
  focused: boolean;
  color: ColorValue;
  size: number;
};

/**
 * Expo Router no dibuja íconos si no se declara `tabBarIcon`: sin esto la barra
 * inferior muestra solamente el texto.
 *
 * Se usa un emoji en vez de `@expo/vector-icons` (que no está instalado) para no
 * sumar dependencias nativas y para que el resultado sea idéntico en Android,
 * iOS y web. El emoji no toma el `color` de la barra, así que el estado activo
 * se marca con opacidad.
 */
export function tabIcon(glyph: string) {
  return function TabIcon({ focused, size }: TabIconProps) {
    return <Text style={{ fontSize: size, opacity: focused ? 1 : 0.5 }}>{glyph}</Text>;
  };
}

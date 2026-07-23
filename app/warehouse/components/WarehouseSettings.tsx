"use client";

import {
  Crosshair,
  EyeOff,
  Grid3X3,
  MousePointer2,
  PackageOpen,
  RotateCcw,
  Ruler,
  Settings,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type WarehouseSettingsState = {
  showInventory: boolean;
  hideZeroInventoryProducts: boolean;
  showFloorGrid: boolean;
  showFloorPlanInfo: boolean;
  focusNewProducts: boolean;
  mobileMultiSelect: boolean;
  mobileTrashDropZone: boolean;
};

const DEFAULT_SETTINGS: WarehouseSettingsState = {
  showInventory: true,
  hideZeroInventoryProducts: false,
  showFloorGrid: true,
  showFloorPlanInfo: true,
  focusNewProducts: true,
  mobileMultiSelect: true,
  mobileTrashDropZone: true,
};

const STORAGE_KEY = "yagami-warehouse-settings-v1";

type WarehouseSettingsContextValue = {
  settings: WarehouseSettingsState;
  updateSetting: <Key extends keyof WarehouseSettingsState>(key: Key, value: WarehouseSettingsState[Key]) => void;
  resetSettings: () => void;
};

const WarehouseSettingsContext = createContext<WarehouseSettingsContextValue | null>(null);

function parseStoredSettings(value: string | null): WarehouseSettingsState {
  if (!value) return DEFAULT_SETTINGS;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return DEFAULT_SETTINGS;
    const stored = parsed as Partial<Record<keyof WarehouseSettingsState, unknown>>;
    return Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS).map(([key, defaultValue]) => [
        key,
        typeof stored[key as keyof WarehouseSettingsState] === "boolean"
          ? stored[key as keyof WarehouseSettingsState]
          : defaultValue,
      ]),
    ) as WarehouseSettingsState;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function WarehouseSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<WarehouseSettingsState>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(parseStoredSettings(window.localStorage.getItem(STORAGE_KEY)));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [loaded, settings]);

  const value = useMemo<WarehouseSettingsContextValue>(() => ({
    settings,
    updateSetting: (key, nextValue) => {
      setSettings((current) => ({ ...current, [key]: nextValue }));
    },
    resetSettings: () => setSettings(DEFAULT_SETTINGS),
  }), [settings]);

  return (
    <WarehouseSettingsContext.Provider value={value}>
      {children}
    </WarehouseSettingsContext.Provider>
  );
}

export function useWarehouseSettings(): WarehouseSettingsContextValue {
  const context = useContext(WarehouseSettingsContext);
  if (!context) throw new Error("useWarehouseSettings must be used within WarehouseSettingsProvider");
  return context;
}

type SettingDefinition = {
  key: keyof WarehouseSettingsState;
  title: string;
  description: string;
  icon: LucideIcon;
};

const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: "showInventory",
    title: "Hiển thị số lượng tồn",
    description: "Hiện tồn kho trên chip và trong danh sách thêm sản phẩm.",
    icon: PackageOpen,
  },
  {
    key: "hideZeroInventoryProducts",
    title: "Ẩn sản phẩm tồn bằng 0",
    description: "Chỉ lọc theo tồn hiện tại; sản phẩm có tồn khác 0 sẽ tự hiện lại.",
    icon: EyeOff,
  },
  {
    key: "showFloorGrid",
    title: "Lưới mặt bằng Kho Đông",
    description: "Hiện các ô 0,5 m và đường chia 1 m trên mặt bằng.",
    icon: Grid3X3,
  },
  {
    key: "showFloorPlanInfo",
    title: "Thông tin kích thước",
    description: "Hiện diện tích kho, tỷ lệ ô và kích thước chip chuẩn.",
    icon: Ruler,
  },
  {
    key: "focusNewProducts",
    title: "Đi tới sản phẩm vừa thêm",
    description: "Tự đưa màn hình tới cụm chip mới sau khi thêm.",
    icon: Crosshair,
  },
  {
    key: "mobileMultiSelect",
    title: "Chọn nhiều trên mobile",
    description: "Nhấn giữ chip 300 ms để bắt đầu chọn nhiều sản phẩm.",
    icon: MousePointer2,
  },
  {
    key: "mobileTrashDropZone",
    title: "Vùng kéo để xóa trên mobile",
    description: "Hiện vùng thả xóa sau khi bắt đầu kéo chip.",
    icon: Trash2,
  },
];

export function WarehouseSettingsButton() {
  const { settings, updateSetting, resetSettings } = useWarehouseSettings();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Mở cài đặt hệ thống"
        className="ml-2 inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 shadow-sm transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        onClick={() => setOpen(true)}
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
        <span className="hidden lg:inline">Cài đặt</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/30 p-0 sm:items-center sm:p-6"
          onMouseDown={() => setOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="warehouse-settings-title"
            className="flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <h2 id="warehouse-settings-title" className="text-base font-semibold text-slate-900">Cài đặt hệ thống</h2>
                <p className="mt-1 text-sm text-slate-600">Bật hoặc tắt các tính năng giao diện trên thiết bị này.</p>
              </div>
              <button
                type="button"
                aria-label="Đóng cài đặt"
                className="cursor-pointer rounded-md p-1.5 text-slate-500 transition-colors duration-200 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {SETTING_DEFINITIONS.map((definition) => {
                const Icon = definition.icon;
                const enabled = settings[definition.key];
                return (
                  <div key={definition.key} className="flex items-center gap-3 rounded-xl px-2 py-3 sm:px-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{definition.title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-600">{definition.description}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={definition.title}
                      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${enabled ? "bg-blue-600" : "bg-slate-300"}`}
                      onClick={() => updateSetting(definition.key, !enabled)}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                );
              })}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t px-5 py-4">
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                onClick={resetSettings}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Mặc định
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                onClick={() => setOpen(false)}
              >
                Xong
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

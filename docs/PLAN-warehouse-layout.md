# Kế hoạch triển khai Warehouse Product Layout Editor

## 0. Phạm vi và quyết định đã chốt

Ứng dụng là công cụ nội bộ một người dùng để bố trí chip sản phẩm trên infinite canvas. KiotViet là nguồn dữ liệu sản phẩm duy nhất; PostgreSQL chỉ lưu trạng thái trình bày.

- Canvas chỉ hiển thị sản phẩm đã có `ProductLayout`.
- Sản phẩm chưa có layout chỉ xuất hiện trong hộp “Thêm sản phẩm”.
- Vị trí được lưu một lần khi thả chip, không ghi liên tục khi kéo.
- KiotViet dùng `client_id`, `client_secret`, `retailer`, token endpoint và API sản phẩm phân trang.
- Không tạo bảng `Product`; không lưu tên, SKU, barcode, giá, tồn kho hay ảnh.
- Không dùng ReactFlow, Redux, node graph hoặc đường nối.
- Chỉ viết code sau khi kế hoạch được duyệt và triển khai từng giai đoạn nhỏ.

## 1. Phân tích yêu cầu

### Chức năng

1. Server lấy toàn bộ catalog từ KiotViet và toàn bộ `ProductLayout` từ PostgreSQL.
2. Merge theo `productId`; chỉ bản ghi có cả product và layout được render.
3. Thêm sản phẩm chưa có layout tại tâm viewport hiện tại.
4. Kéo chip tự do; lưu `x`, `y` khi drag end.
5. Đổi màu bằng double-click hoặc context menu.
6. Context menu hỗ trợ đổi màu, chuyển chip ra giữa màn hình và xóa layout.
7. Search theo tên của chip đang có; pan tới chip và highlight tạm thời.
8. Toolbar có Add, Search, Zoom %, Reset View và Center All.
9. Zoom bằng `Ctrl + Wheel` trong 20–500%; pan bằng chuột giữa hoặc `Space + Drag`.

### Ngoài phạm vi

- CRUD sản phẩm KiotViet, đồng bộ catalog vào database, quản lý tồn/giá.
- Multi-user/realtime, lịch sử phiên bản, đường nối, nhóm node, mindmap.
- Lưu viewport trong database ở MVP.

### Tiêu chí hoàn thành MVP

- Reload giữ đúng vị trí và màu; tên luôn phản ánh KiotViet.
- Sản phẩm chưa có layout không xuất hiện trên canvas.
- Mọi thao tác canvas đúng ở 20%, 100% và 500% zoom.
- Lỗi mutation rollback UI; lỗi KiotViet có trạng thái lỗi rõ ràng.
- Database và client bundle không chứa dữ liệu/credential ngoài phạm vi.

## 2. Kiến trúc tổng thể

```text
Browser: Toolbar + Dialogs + Interactive Canvas
          │ Server Actions
Next.js Server
  ├─ Layout application service ─ Prisma repository ─ Postgres
  └─ ProductCatalogService ─ KiotViet adapter ─ KiotViet API
```

- `app/warehouse/page.tsx` là Server Component: tải catalog/layout song song, merge và truyền DTO tối thiểu.
- `WarehouseWorkspace` là client composition root cho canvas state và mutation workflow.
- UI không gọi KiotViet; credential/token không bao giờ xuống browser.
- Application layer chỉ phụ thuộc interface `ProductCatalogService`, không phụ thuộc implementation KiotViet.
- Factory server-only là composition root, cho phép inject fake service trong test hoặc thay ERP sau này.

DTO client tối thiểu:

- `CanvasProduct`: `productId`, `name`, `x`, `y`, `color`.
- `ProductOption`: `productId`, `name`.
- Không gửi raw response KiotViet xuống client.

## 3. Thiết kế database

Giữ đúng model đã yêu cầu:

```prisma
model ProductLayout {
  id        String   @id @default(cuid())
  productId Int      @unique
  x         Float
  y         Float
  color     String   @default("#3b82f6")
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())
}
```

- `x`, `y` là tọa độ world-space của góc trên-trái chip; số âm hợp lệ.
- Zod bắt buộc tọa độ hữu hạn và `productId` là số nguyên dương.
- `color` chỉ nhận giá trị trong palette cố định để tránh CSS tùy ý.
- `productId @unique` bảo đảm một sản phẩm chỉ có một chip.
- Không có foreign key tới KiotViet và không tạo bảng `Product`.
- Layout không còn product tương ứng là “orphan”: không render, không tự xóa, ghi log an toàn để tránh mất dữ liệu do API lỗi tạm thời.

## 4. Thiết kế luồng dữ liệu

### Tải trang

1. Chạy song song `ProductCatalogService.listProducts()` và repository `listAll()`.
2. Lập `Map` theo `productId` và merge tuyến tính.
3. Có product + layout → `canvasProducts`.
4. Có product, chưa có layout → `availableProducts`.
5. Có layout, không có product → bỏ render và ghi log orphan.

### Thêm sản phẩm

Chọn trong `availableProducts` → đổi tâm viewport từ screen-space sang world-space → Server Action xác minh product còn tồn tại → tạo layout → trả DTO → chuyển item sang `canvasProducts`. Thêm liên tiếp dùng offset nhỏ để tránh chồng hoàn toàn.

### Drag

Trong lúc kéo chỉ cập nhật transform hiển thị. Khi thả:

```text
worldDelta = screenDelta / currentScale
newPosition = storedWorldPosition + worldDelta
```

Client cập nhật optimistic, gọi action một lần, rollback và toast nếu thất bại. Hành vi của dnd-kit dưới CSS transform phải được kiểm chứng bằng prototype ở nhiều mức zoom.

### Màu, xóa và focus

- Đổi màu: optimistic update → action → rollback nếu lỗi.
- Xóa: chỉ xóa `ProductLayout`; thành công thì đưa product về danh sách Add.
- Search: tìm trong chip đang có, pan viewport tới chip, giữ zoom hiện tại và highlight 1.5–2 giây.
- “Đưa ra giữa màn hình”: không pan viewport; tính world center, cập nhật tọa độ chip và lưu.

## 5. Thiết kế KiotViet Service

### Contract và cấu trúc

`ProductCatalogService` cung cấp `listProducts()` và `getProductById()`, trả internal DTO chỉ gồm `id` và `name`. Implementation gồm:

```text
lib/kiotviet.ts                 public facade
lib/kiotviet/contracts.ts
lib/kiotviet/config.ts
lib/kiotviet/token-provider.ts
lib/kiotviet/http-client.ts
lib/kiotviet/product-catalog.ts
lib/kiotviet/schemas.ts
lib/kiotviet/errors.ts
```

### Cấu hình và bảo mật

- Env: `KIOTVIET_CLIENT_ID`, `KIOTVIET_CLIENT_SECRET`, `KIOTVIET_RETAILER`, `KIOTVIET_TOKEN_URL`, `KIOTVIET_API_BASE_URL`.
- Parse env bằng Zod trong module `server-only`; không dùng `NEXT_PUBLIC_`.
- Không log secret, access token hoặc raw response không cần thiết.
- Xác nhận chính xác endpoint/header theo tài khoản KiotViet trước giai đoạn integration.

### Token

- Memory cache token kèm expiry; refresh sớm với safety window.
- Deduplicate concurrent refresh bằng một shared promise trong mỗi instance.
- Khi gặp 401: invalidate, refresh và retry đúng một lần.
- Serverless instance có cache riêng; cache là tối ưu, không phải source of truth.

### Pagination và cache catalog

- Lấy từng trang tuần tự với page size hợp lệ, deduplicate theo ID và có giới hạn trang bảo vệ.
- Validate response cần dùng bằng Zod; không truyền raw schema sang application layer.
- Cache catalog theo retailer với TTL ngắn dự kiến 1–5 phút.
- Không ghi catalog/token vào PostgreSQL.
- Timeout bằng `AbortSignal`; retry giới hạn với backoff + jitter cho timeout, 429 và 5xx; tôn trọng `Retry-After`.
- Phân loại lỗi cấu hình, xác thực, rate limit, unavailable và invalid response để UI/log xử lý đúng.

## 6. Thiết kế UI và Infinite Canvas

### Hệ tọa độ

Viewport có `scale`, `panX`, `panY`; database luôn lưu world-space:

```text
screenX = worldX × scale + panX
worldX  = (screenX - panX) / scale
```

Mọi thao tác drag, add-at-center, focus, center chip và Center All dùng chung utilities chuyển đổi; không tạo nguồn transform thứ hai.

### Interaction

- `react-zoom-pan-pinch` quản lý viewport; min `0.2`, max `5`.
- Chỉ `Ctrl + Wheel` zoom tại con trỏ; prevent browser zoom trong vùng canvas khi event được xử lý.
- Middle mouse hoặc `Space + Drag` pan; Space bị bỏ qua trong input/textarea/select/contenteditable.
- Chuột trái trên chip drag; chuột phải mở menu; double-click mở palette.
- Reset View về 100% và origin mặc định.
- Center All tính bounding box của chip, thêm padding, fit scale trong giới hạn; canvas rỗng thì disable/reset.

### Giao diện

- Toolbar nổi/cố định; canvas chiếm phần còn lại của viewport.
- Chip một dòng gồm icon package và tên, ellipsis + tooltip nếu dài; không hiện trường khác.
- Trạng thái chip: normal, dragging, highlighted, pending save.
- Add dialog chỉ tìm trong sản phẩm chưa có layout; Search dialog chỉ tìm chip đang có.
- Context menu và dialog dùng primitive shadcn/Radix để có focus/keyboard accessibility.
- Có loading skeleton, empty state, page error cho KiotViet và toast lỗi mutation.

## 7. Danh sách Components

```text
app/warehouse/
  page.tsx                     Server orchestration
  loading.tsx
  error.tsx
  components/
    WarehouseWorkspace.tsx    Client composition/state
    Canvas.tsx                Viewport transform/input
    CanvasSurface.tsx         World surface + DndContext
    ProductChip.tsx           Chip presentation/interactions
    Toolbar.tsx
    AddProductDialog.tsx
    SearchDialog.tsx
    ColorDialog.tsx
    ProductContextMenu.tsx
    CanvasEmptyState.tsx
    CanvasErrorState.tsx
    ZoomIndicator.tsx
```

Component nhận dữ liệu/callback rõ ràng; dialog và chip không tự gọi KiotViet hoặc Prisma.

## 8. Danh sách Hooks và Utilities

- `useCanvas`: reset, center all, focus product, đọc transform/world center.
- `useCanvasCoordinates`: screen/world conversion, delta conversion, viewport center, bounds.
- `useKeyboard`: Space state, bỏ qua form fields, reset khi window blur.
- `useProductDrag`: sensor, drag lifecycle, scale correction, cancel/end.
- `useProductMutations`: pending, optimistic update, action call, rollback/toast.
- `useProductSearch`: normalize và tìm tên chip hiện có.
- `useTransientHighlight`: timer highlight và cleanup.
- Hàm thuần nằm trong `lib/canvas/{coordinates,bounds,colors,search}.ts` để unit test độc lập.

Không dùng React Query/SWR ở MVP; Server Component tải initial data và local state xử lý mutation. Chỉ bổ sung nếu đo được nhu cầu refetch/cache client thực tế.

## 9. Server Actions

Đặt trong `app/warehouse/actions/product-layout.ts`, schema/result tách nhỏ khi cần. Mọi action chạy server-only, parse Zod, trả discriminated union `{ ok, data | error }`, không lộ Prisma error.

- `createProductLayout({ productId, x, y, color? })`: xác minh product qua catalog service; xử lý unique conflict thành lỗi nghiệp vụ.
- `updateProductPosition({ productId, x, y })`: update layout tồn tại; không gọi KiotViet ở mỗi lần kéo.
- `updateProductColor({ productId, color })`: chỉ nhận palette cho phép.
- `deleteProductLayout({ productId })`: chỉ xóa layout; lựa chọn idempotent sẽ được thống nhất khi triển khai.

Mutation trả DTO trực tiếp để cập nhật client. Có thể `revalidatePath('/warehouse')`, nhưng không `router.refresh()` sau mỗi drag vì sẽ làm giật/reset viewport. Cần bảo vệ Server Actions bằng lớp access control của ứng dụng, không dựa vào việc UI chỉ có một người dùng.

## 10. Quy trình đồng bộ với KiotViet

Đây là read-and-merge, không phải sao chép dữ liệu:

1. Mỗi lần tải, catalog lấy từ KiotViet/cache và merge với layout local.
2. Tên đổi ở KiotViet xuất hiện sau lần refresh/cache expiry tiếp theo.
3. Product mới xuất hiện trong Add dialog sau refresh.
4. Product ngừng được API trả về khiến layout thành orphan nhưng không bị tự xóa.
5. Khi Add, server xác minh lại ID trước khi insert.
6. Không cron/webhook ghi catalog, không mutation KiotViet, không coi browser cache là nguồn dữ liệu.

Sau MVP có thể thêm “Làm mới sản phẩm” để invalidate catalog cache và refresh data có kiểm soát.

## 11. Kế hoạch triển khai theo giai đoạn

### Giai đoạn 1 — Nền tảng

Scaffold Next.js 15/React 19/strict TS, Tailwind, ESLint, shadcn tối thiểu, `/warehouse`, `.env.example`. Kiểm chứng lint/build; không commit secret.

### Giai đoạn 2 — Prisma

Thêm đúng schema, Prisma singleton, migration và layout repository. Kiểm chứng validate/generate/migration/CRUD; xác nhận không có bảng Product.

### Giai đoạn 3 — Contract và application service

Tạo catalog interface, fake adapter và logic merge. Unit test đủ trường hợp có layout, chưa có layout, orphan và catalog rỗng.

### Giai đoạn 4 — KiotViet auth/HTTP

Token provider, timeout, retry, 401 refresh một lần, safe logging. Test expiry, concurrent refresh và không lộ token.

### Giai đoạn 5 — Pagination/cache

Tải đủ trang, validate, deduplicate, TTL cache và get-by-ID. Test một/nhiều trang, malformed response, 429/5xx và điều kiện dừng.

### Giai đoạn 6 — Initial UI tĩnh

Server page tải/merge; render toolbar, chip, loading/error/empty. Kiểm chứng chỉ product có layout xuất hiện và chỉ hiện tên.

### Giai đoạn 7 — Prototype pan/zoom

Tích hợp viewport, keyboard/mouse mapping, zoom indicator/reset và coordinate utilities. Test 20/100/500%, input Space và browser zoom. Đây là technical checkpoint trước drag.

### Giai đoạn 8 — Drag/persist

Tích hợp dnd-kit, scale correction, action cập nhật, optimistic rollback. Kiểm chứng không request khi move, tối đa một mutation khi thả và chính xác ở nhiều scale.

### Giai đoạn 9 — Add product

Dialog, search available product, world viewport center, create action và client list update. Test duplicate, nhiều scale/pan và reload.

### Giai đoạn 10 — Color/context actions

Double-click, palette, menu, center chip, remove/rollback. Test persistence, palette validation và product trở lại Add dialog.

### Giai đoạn 11 — Search/Center All

Search có normalize tiếng Việt, focus/highlight, bounds/fit-to-view. Test tọa độ âm, chip cách xa và canvas rỗng.

### Giai đoạn 12 — Hardening

Accessibility, error boundaries, auth/access control, logging, profiling, README và Vercel compatibility. Chạy lint, typecheck, build, unit/integration/E2E.

### Giai đoạn 13 — Deploy

Cấu hình Vercel env, Postgres, `prisma migrate deploy`, production deployment và smoke test KiotViet + layout CRUD + cold start. Preview và production dùng database/env tách biệt.

Sau khi duyệt kế hoạch, chỉ triển khai Giai đoạn 1 rồi báo file thay đổi, quyết định kỹ thuật, kết quả kiểm chứng và chờ duyệt giai đoạn tiếp theo.

## 12. Rủi ro kỹ thuật

- **dnd-kit dưới CSS scale:** delta có thể sai; prototype sớm, một transform source và test nhiều scale.
- **Gesture conflict:** drag/pan/right-click/double-click tranh event; quy định button, activation constraint và test cancel.
- **Catalog lớn/cold start:** dùng TTL cache, DTO tối thiểu, page size hợp lệ; tối ưu concurrency chỉ sau đo đạc.
- **KiotViet rate limit/unavailable:** timeout, retry giới hạn, `Retry-After`, không gọi API cho position update.
- **Cache serverless phân tán:** cache chỉ là tối ưu; correctness không phụ thuộc memory.
- **Orphan layout:** không tự xóa; log và bổ sung công cụ dọn có xác nhận sau này.
- **Float/CSS precision:** chấp nhận tọa độ âm/lớn nhưng reject NaN/Infinity; infinite là thực dụng, không vô hạn toán học.
- **Optimistic save thất bại:** giữ previous state, rollback và báo lỗi rõ.
- **Ứng dụng một người nhưng route public:** cần Vercel protection hoặc auth tối thiểu và bảo vệ action.
- **Migration nhầm môi trường:** tách env, review migration, backup policy và smoke test.

## 13. Đề xuất cải tiến

Không chặn MVP:

- Ưu tiên cao: route protection/auth, refresh catalog thủ công, keyboard shortcuts, undo gần nhất, orphan-layout audit.
- Khi số chip lớn: viewport culling/virtualization, spatial index và search index; chỉ làm sau profiling.
- Canvas: minimap, snap-to-grid tùy chọn, multi-select, khóa chip, persist viewport bằng localStorage.
- Reliability: optimistic concurrency/audit log nếu chuyển sang multi-user, shared catalog cache khi traffic tăng.
- Observability: structured logs, error monitoring, KiotViet latency/page count/cache hit/mutation failure/orphan count.

## 14. Kiểm thử và checklist nghiệm thu

### Unit

- Coordinate transform/inverse, scaled delta, viewport center, bounds/fit scale.
- Merge catalog/layout, search tiếng Việt, Zod schemas.
- Token expiry/refresh/dedup và pagination termination/dedup.

### Integration/component

- Prisma repository và Server Actions với fake catalog.
- Duplicate create, update/delete missing layout, rollback paths.
- Dialog lọc đúng; chip không render trường bị cấm; keyboard không chặn input.

### E2E

1. Tải đúng chip từ KiotViet + layout.
2. Pan bằng middle mouse và Space.
3. Zoom Ctrl+Wheel trong giới hạn.
4. Drag ở nhiều zoom, chỉ lưu khi thả, reload đúng vị trí.
5. Add tại tâm viewport; đổi màu; search/focus; Center All.
6. Xóa khỏi canvas và thêm lại mà không tác động KiotViet.

### Production checklist

- Lint, typecheck, tests và build đều đạt.
- Không có secret trong client bundle/log.
- Migration đúng production database.
- KiotViet auth/pagination và CRUD layout hoạt động trên Vercel.
- Đo thời gian tải catalog, số request API, FPS pan/zoom và mutation latency với dữ liệu gần thực tế.

## 15. Cấu trúc file dự kiến

```text
app/warehouse/{page,loading,error}.tsx
app/warehouse/actions/
app/warehouse/components/
app/warehouse/hooks/
components/ui/
lib/prisma.ts
lib/product-layout/
lib/kiotviet.ts
lib/kiotviet/
lib/canvas/
prisma/schema.prisma
prisma/migrations/
tests/{unit,integration,e2e}/
docs/PLAN-warehouse-layout.md
.env.example
README.md
```

Chỉ tách abstraction khi trách nhiệm thực tế xuất hiện; cấu trúc trên là đích dự kiến, không phải yêu cầu tạo toàn bộ ngay từ đầu.

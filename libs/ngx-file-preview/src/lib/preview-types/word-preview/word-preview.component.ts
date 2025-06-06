import {ChangeDetectionStrategy, Component, ElementRef, OnChanges, SimpleChanges, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {BasePreviewComponent} from '../base-preview/base-preview.component';
import {PreviewIconComponent} from '../../components/preview-icon/preview-icon.component';
import {renderAsync} from 'docx-preview';
import {FileReaderResponse} from "../../services";
import {I18nPipe} from "../../i18n";

@Component({
  selector: 'ngx-word-preview',
  standalone: true,
  imports: [CommonModule, PreviewIconComponent, I18nPipe],
  template: `
    <div class="word-container">
      <div class="toolbar">
        <div class="left-controls">
          <button class="tool-btn" (click)="zoomOut()" [disabled]="scale <= MIN_SCALE">
            <preview-icon [themeMode]="themeMode" name="zoom-out" [title]="'preview.toolbar.zoomOut'|i18n"></preview-icon>
          </button>
          <span class="zoom-text" (click)="resetZoom()" [title]="'preview.toolbar.resetZoom'|i18n">
            {{ (scale * 100).toFixed(0) }}%
          </span>
          <button class="tool-btn" (click)="zoomIn()" [disabled]="scale >= MAX_SCALE">
            <preview-icon [themeMode]="themeMode" name="zoom-in" [title]="'preview.toolbar.zoomIn'|i18n"></preview-icon>
          </button>
        </div>
        <div class="right-controls">
          <button class="tool-btn" (click)="toggleFullscreen()">
            <preview-icon [themeMode]="themeMode" name="fullscreen" [title]="'preview.toolbar.fullscreen'|i18n"></preview-icon>
          </button>
        </div>
      </div>

      <div class="preview-container"
           #previewContainer
           (wheel)="handleWheel($event)"
           (pointerdown)="startDrag($event)"
           (pointermove)="onDrag($event)"
           (pointerup)="stopDrag($event)"
           [class.dragging]="isDragging">
        <div class="content-wrapper">
          <div #content
               class="preview-content"
               [style.transform]="'scale(' + scale + ')'">
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ["../../styles/_theme.scss", "word-preview.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WordPreviewComponent extends BasePreviewComponent implements OnChanges {
  @ViewChild('content') content!: ElementRef<HTMLDivElement>;
  @ViewChild('previewContainer') previewContainer!: ElementRef<HTMLDivElement>;

  // 缩放相关常量
  protected readonly MIN_SCALE = 0.25;
  protected readonly MAX_SCALE = 4;
  protected readonly SCALE_STEP = 0.1;
  protected readonly DEFAULT_SCALE = 1;

  // 状态
  protected scale = 1;
  protected isDragging = false;

  // 拖拽相关
  private startX = 0;
  private startY = 0;
  private scrollLeft = 0;
  private scrollTop = 0;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['file']) {
      this.loadFile()
    }
  }
  override async handleFileContent(content: FileReaderResponse) {
    try {
      await renderAsync(content.data, this.content.nativeElement, undefined, {
        className: 'docx-content',
        inWrapper: false,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        useBase64URL: true,
      });
    } catch (error) {
      console.log("error", error)
    }
    this.cdr.markForCheck();
  }

  handleWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const delta = event.deltaY < 0 ? 1 : -1;
      if (delta > 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
    }
  }

  startDrag(event: PointerEvent) {
    if (event.button !== 0) return;

    this.isDragging = true;
    const container = this.previewContainer.nativeElement;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.scrollLeft = container.scrollLeft;
    this.scrollTop = container.scrollTop;

    container.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  onDrag(event: PointerEvent) {
    if (!this.isDragging) return;

    const container = this.previewContainer.nativeElement;
    const deltaX = event.clientX - this.startX;
    const deltaY = event.clientY - this.startY;

    container.scrollLeft = this.scrollLeft - deltaX;
    container.scrollTop = this.scrollTop - deltaY;
  }

  stopDrag(event: PointerEvent) {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.previewContainer.nativeElement.releasePointerCapture(event.pointerId);
  }


  zoomIn() {
    if (this.scale < this.MAX_SCALE) {
      this.scale = Math.min(this.MAX_SCALE, this.scale + this.SCALE_STEP);
      this.applyZoom();
    }
  }

  zoomOut() {
    if (this.scale > this.MIN_SCALE) {
      this.scale = Math.max(this.MIN_SCALE, this.scale - this.SCALE_STEP);
      this.applyZoom();
    }
  }

  resetZoom() {
    this.scale = this.DEFAULT_SCALE;
    this.applyZoom();
  }

  private applyZoom() {
    if (this.content?.nativeElement && this.previewContainer?.nativeElement) {
      const container = this.previewContainer.nativeElement;
      const rect = container.getBoundingClientRect();

      // 获取当前滚动中心点
      const centerX = (container.scrollLeft + rect.width / 2) / this.scale;
      const centerY = (container.scrollTop + rect.height / 2) / this.scale;

      // 更新缩放
      this.content.nativeElement.style.transform = `scale(${this.scale})`;
      this.content.nativeElement.style.transformOrigin = 'top left';

      // 调整滚动位置，确保视图保持缩放中心一致
      requestAnimationFrame(() => {
        container.scrollLeft = centerX * this.scale - rect.width / 2;
        container.scrollTop = centerY * this.scale - rect.height / 2;
      });
    }
    this.cdr.markForCheck();
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }
}


export class EmptyImageController {
    private _emptyImage: HTMLImageElement;

    constructor() {
        this._emptyImage = new Image(1, 1);
        this._emptyImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }

    get emptyImage() {
        return this._emptyImage;
    }

    hideDragImage = (dataTransfer: DataTransfer) => {
        dataTransfer.effectAllowed = 'move';
        dataTransfer.setDragImage(this._emptyImage, 0, 0);
    }

    destroy = () => {
        this._emptyImage.remove();
    }
}
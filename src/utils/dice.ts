export class Dice {

    public static rollD20(): number {
        return Math.floor(Math.random() * 20) + 1;
    }

}
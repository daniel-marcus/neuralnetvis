# NeuralNetVis

Wrap your head around neural networks and watch machines learning: NeuralNetVis is a platform for visualizing and exploring neural networks in your browser. Built with [TensorFlow.js](https://github.com/tensorflow/tfjs) and [three.js](https://github.com/mrdoob/three.js).

Live here: [https://neuralnetvis.app](https://neuralnetvis.app)

## Datasets

These datasets are available at the moment; most of them are smaller subsets of the original datasets to keep network load and memory usage reasonable.

| Name                                                                    |  Description           | Task           | Features | Train samples | Test samples |
| ----------------------------------------------------------------------- | ---------------------- | -------------- | -------: | ------------: | -----------: |
| [MNIST](https://en.wikipedia.org/wiki/MNIST_database)                   | Handwritten digits     | Classification |  28x28x1 |        20,000 |        2,000 |
| [Fashion MNIST](https://github.com/zalandoresearch/fashion-mnist)       | Clothing items         | Classification |  28x28x1 |        20,000 |        2,000 |
| [CIFAR10](https://www.cs.toronto.edu/~kriz/cifar.html)                  | Colored images         | Classification |  32x32x3 |        18,000 |        1,800 |
| [California Housing](https://keras.io/api/datasets/california_housing/) | Predict housing prices |  Regression    |        8 |        17,000 |        3,000 |

## Model Import (experimental)

Pretrained models from Python Tensorflow can be exported via [tfjs-converter](https://github.com/tensorflow/tfjs/tree/master/tfjs-converter) and then imported in the _my models_ section.

Currently supported layer types: _Dense_, _Conv2D_, _MaxPooling2D_, _Flatten_, and _Dropout_.

## Folder structure

- **app**: Layout and pages for the [Next.js](https://nextjs.org/) App Router
- **components**: Main UI components
- **contents**: Lessons and specific UI elements for lessons
- **data**: Dataset definitions and all logic related to loading and storing datasets
- **model**: Everything related to TensorFlow.js and ML: model creation, training, activations, weights and biases
- **neuron-layers**: Here is where the current state get's poured into layers of neurons
- **scene**: Everything related to rendering the model with three.js
- **store**: The global [Zustand](https://github.com/pmndrs/zustand) store for state and settings
- **utils**: Everything else

## Resources, Inspirations, and Credits

- [Stanford University CS231n – Deep Learning for Computer Vision](https://cs231n.github.io): A great resource for all the theory behind this project
- [An Interactive Node-Link Visualization of Convolutional Neural Networks](https://adamharley.com/nn_vis/) by Adam W. Harley
- Tensorflow's [Neural Network Playground](https://playground.tensorflow.org/)
- The settings UI was inspired by [Leva](https://github.com/pmndrs/leva)
- The logo and the lesson headings use a modified version of the _BlurVision ASCII_ font by Aiden Neuding using patorjk's [figlet.js](https://github.com/patorjk/figlet.js) for ASCII Art

```
▓████████▓   ▓█▓    ▓█▓    ▓██████▓    ▓███████▓    ▓█▓    ▓█▓    ▓███████▓   ▓█▓
   ▓█▓       ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓          ▓█▓
   ▓█▓       ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓          ▓█▓
   ▓█▓       ▓████████▓   ▓████████▓   ▓█▓    ▓█▓   ▓███████▓     ▓██████▓    ▓█▓
   ▓█▓       ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓          ▓█▓   ▓█▓
   ▓█▓       ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓          ▓█▓
   ▓█▓       ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓█▓    ▓█▓   ▓███████▓    ▓█▓
```
